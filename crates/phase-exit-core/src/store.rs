//! Immutable content-addressed objects and explicit adoption-chain serialization.
use crate::{absolute, require, valid_id, Error, Result};
use serde::{de::DeserializeOwned, Serialize};
use sha2::{Digest, Sha256};
use std::{fs::{self, File, OpenOptions}, io::{Read, Write}, path::{Path, PathBuf}};
pub const MAX_JSON: u64 = 32 * 1024 * 1024;
pub fn bytes_hash(bytes: &[u8]) -> String { format!("{:x}", Sha256::digest(bytes)) }
pub fn digest<T: Serialize>(value: &T) -> Result<String> {
    // serde_json's default object representation is a sorted BTreeMap.
    Ok(bytes_hash(&serde_json::to_vec(&serde_json::to_value(value)?)?))
}
pub fn bounded_read(path: &Path, limit: u64) -> Result<Vec<u8>> {
    let mut bytes = Vec::new(); File::open(path)?.take(limit + 1).read_to_end(&mut bytes)?;
    require(bytes.len() as u64 <= limit, "artifact exceeds bounded input size; no truncation permitted")?; Ok(bytes)
}
pub fn read_json<T: DeserializeOwned>(path: impl AsRef<Path>) -> Result<T> {
    let value: StrictValue = serde_json::from_slice(&bounded_read(path.as_ref(), MAX_JSON)?)?;
    Ok(serde_json::from_value(value.0)?)
}
struct StrictValue(serde_json::Value);
impl<'de> serde::Deserialize<'de> for StrictValue {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> std::result::Result<Self,D::Error> {
        struct Visitor;
        impl<'de> serde::de::Visitor<'de> for Visitor {
            type Value = StrictValue;
            fn expecting(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result { f.write_str("JSON without duplicate object keys") }
            fn visit_bool<E:serde::de::Error>(self,v:bool)->std::result::Result<Self::Value,E> { Ok(StrictValue(v.into())) }
            fn visit_i64<E:serde::de::Error>(self,v:i64)->std::result::Result<Self::Value,E> { Ok(StrictValue(v.into())) }
            fn visit_u64<E:serde::de::Error>(self,v:u64)->std::result::Result<Self::Value,E> { Ok(StrictValue(v.into())) }
            fn visit_f64<E:serde::de::Error>(self,v:f64)->std::result::Result<Self::Value,E> { serde_json::Number::from_f64(v).map(|n|StrictValue(n.into())).ok_or_else(||E::custom("non-finite JSON number")) }
            fn visit_str<E:serde::de::Error>(self,v:&str)->std::result::Result<Self::Value,E> { Ok(StrictValue(v.into())) }
            fn visit_string<E:serde::de::Error>(self,v:String)->std::result::Result<Self::Value,E> { Ok(StrictValue(v.into())) }
            fn visit_unit<E:serde::de::Error>(self)->std::result::Result<Self::Value,E> { Ok(StrictValue(serde_json::Value::Null)) }
            fn visit_seq<A:serde::de::SeqAccess<'de>>(self,mut seq:A)->std::result::Result<Self::Value,A::Error> { let mut values=Vec::new(); while let Some(v)=seq.next_element::<StrictValue>()? { values.push(v.0); } Ok(StrictValue(values.into())) }
            fn visit_map<A:serde::de::MapAccess<'de>>(self,mut map:A)->std::result::Result<Self::Value,A::Error> { let mut values=serde_json::Map::new(); while let Some((k,v))=map.next_entry::<String,StrictValue>()? { if values.insert(k,v.0).is_some() { return Err(serde::de::Error::custom("duplicate JSON object key")); } } Ok(StrictValue(values.into())) }
        }
        deserializer.deserialize_any(Visitor)
    }
}
pub fn file_hash(path: impl AsRef<Path>) -> Result<String> {
    let mut file = File::open(path)?; let mut hash = Sha256::new(); let mut buffer = [0_u8; 65536];
    loop { let count = file.read(&mut buffer)?; if count == 0 { break; } hash.update(&buffer[..count]); }
    Ok(format!("{:x}", hash.finalize()))
}
pub fn immutable(path: &Path, bytes: &[u8]) -> Result<()> {
    if let Ok(secret) = std::env::var("JEV_API_KEY") { require(secret.is_empty() || !bytes.windows(secret.len()).any(|window|window == secret.as_bytes()), "refusing to persist process credential in artifact")?; }
    if let Some(parent) = path.parent() { fs::create_dir_all(parent)?; }
    match OpenOptions::new().create_new(true).write(true).open(path) {
        Ok(mut file) => { file.write_all(bytes)?; file.sync_all()?; Ok(()) },
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => require(fs::read(path)? == bytes, "immutable artifact collision"),
        Err(error) => Err(error.into()),
    }
}
#[derive(Clone)]
pub struct Store { pub root: PathBuf }
impl Store {
    pub fn open(root: impl AsRef<Path>) -> Result<Self> { absolute(&root.as_ref().to_string_lossy())?; fs::create_dir_all(root.as_ref())?; Ok(Self { root: root.as_ref().to_owned() }) }
    pub fn put<T: Serialize>(&self, kind: &str, value: &T) -> Result<String> { let hash = digest(value)?; self.put_named(kind, &hash, value)?; Ok(hash) }
    pub fn put_named<T: Serialize>(&self, kind: &str, id: &str, value: &T) -> Result<()> { valid_id(kind)?; valid_id(id)?; immutable(&self.root.join(kind).join(format!("{id}.json")), &serde_json::to_vec(&serde_json::to_value(value)?)?) }
    pub fn get<T: DeserializeOwned>(&self, kind: &str, id: &str) -> Result<T> { valid_id(kind)?; valid_id(id)?; read_json(self.root.join(kind).join(format!("{id}.json"))) }
    pub fn exists(&self, kind: &str, id: &str) -> Result<bool> { valid_id(kind)?; valid_id(id)?; Ok(self.root.join(kind).join(format!("{id}.json")).exists()) }
    pub fn list(&self, kind: &str) -> Result<Vec<PathBuf>> {
        valid_id(kind)?; let path = self.root.join(kind); if !path.exists() { return Ok(Vec::new()); }
        let mut paths = fs::read_dir(path)?.map(|entry| entry.map(|e| e.path())).collect::<std::io::Result<Vec<_>>>()?;
        paths.retain(|p| p.extension().is_some_and(|e| e == "json")); paths.sort(); Ok(paths)
    }
    pub fn lock(&self) -> Result<Lock> { let path = self.root.join("writer.lock"); let mut file = OpenOptions::new().create_new(true).write(true).open(&path).map_err(|e| Error::Invalid(format!("state writer lock unavailable: {}", e.kind())))?; write!(file, "{}", std::process::id())?; Ok(Lock(path)) }
}
pub struct Lock(PathBuf);
impl Drop for Lock { fn drop(&mut self) { let _ = fs::remove_file(&self.0); } }
