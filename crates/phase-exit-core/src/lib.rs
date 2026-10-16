//! Reusable phase-exit engine. The host authorizes actions; this engine never runs gates.
pub mod types;
pub mod store;
pub mod lifecycle;
pub mod engine;
pub mod jev;
pub mod hooks;
pub mod schema;
pub use types::*;
pub use store::{digest, file_hash, read_json, Store};
pub use engine::{evaluate, authorize, EvaluationOptions};
use std::path::Path;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("invalid input: {0}")] Invalid(String),
    #[error("I/O operation failed: {0}")] Io(#[from] std::io::Error),
    #[error("JSON protocol error: {0}")] Json(#[from] serde_json::Error),
    #[error("JEV unavailable: {0}")] Jev(String),
    #[error("extension hook blocked: {0}")] Hook(String),
}
pub type Result<T> = std::result::Result<T, Error>;
pub fn require(ok: bool, message: impl Into<String>) -> Result<()> { if ok { Ok(()) } else { Err(Error::Invalid(message.into())) } }
pub fn version(v: u32) -> Result<()> { require(v == 1, "schema_version must be 1") }
pub fn valid_id(id: &str) -> Result<()> { require(!id.is_empty() && id.len() <= 128 && id.bytes().all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c)) && id != "." && id != "..", "invalid stable identifier") }
pub fn valid_hash(hash: &str) -> Result<()> { require(hash.len() == 64 && hash.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c)), "expected lowercase SHA-256") }
pub fn absolute(path: &str) -> Result<()> { require(Path::new(path).is_absolute(), "artifact and action paths must be absolute") }
pub fn now() -> Result<u64> { std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|v| v.as_secs()).map_err(|_| Error::Invalid("clock precedes Unix epoch".into())) }
