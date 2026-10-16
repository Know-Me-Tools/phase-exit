//! Exported JSON Schemas and runtime shape validation for the supported protocol.
use crate::{*,types::*};
use serde_json::Value;
pub fn export(kind: &str) -> Result<Value> {
    let source = match kind {
        "contract" => include_str!("../../../schemas/contract.schema.json"),
        "evidence" => include_str!("../../../schemas/evidence.schema.json"),
        "decision" => include_str!("../../../schemas/decision.schema.json"),
        "adoption" => include_str!("../../../schemas/adoption.schema.json"),
        "learning" => include_str!("../../../schemas/learning.schema.json"),
        "action" => include_str!("../../../schemas/action.schema.json"),
        _ => return Err(Error::Invalid("unknown schema kind".into())),
    }; Ok(serde_json::from_str(source)?)
}
fn shape(schema: &Value, value: &Value) -> Result<()> {
    if let Some(alternatives) = schema.get("anyOf").and_then(Value::as_array) { require(alternatives.iter().any(|s|shape(s,value).is_ok()),"value does not satisfy nullable schema")?; }
    if let Some(alternatives) = schema.get("oneOf").and_then(Value::as_array) { require(alternatives.iter().filter(|s|shape(s,value).is_ok()).count() == 1,"value does not satisfy exactly one predicate schema")?; }
    if let Some(expected) = schema.get("const") { require(value == expected,"constant protocol value mismatch")?; }
    if let Some(allowed) = schema.get("enum").and_then(Value::as_array) { require(allowed.contains(value),"unknown enumerated protocol value")?; }
    if let Some(kind) = schema.get("type").and_then(Value::as_str) {
        let matches = match kind { "object" => value.is_object(),"array" => value.is_array(),"string" => value.is_string(),"integer" => value.is_i64() || value.is_u64(),"number" => value.is_number(),"boolean" => value.is_boolean(),"null" => value.is_null(),_ => false };
        require(matches,"JSON field has wrong type")?;
    }
    if let Some(object) = value.as_object() {
        if let Some(required) = schema.get("required").and_then(Value::as_array) { for name in required { require(name.as_str().is_some_and(|s|object.contains_key(s)),format!("missing required field {name}"))?; } }
        if let Some(minimum) = schema.get("minProperties").and_then(Value::as_u64) { require(object.len() as u64 >= minimum,"too few object properties")?; }
        let properties = schema.get("properties").and_then(Value::as_object);
        for (name,field) in object {
            if let Some(property) = properties.and_then(|p|p.get(name)) { shape(property,field)?; }
            else if let Some(additional) = schema.get("additionalProperties") { if additional == &Value::Bool(false) { return Err(Error::Invalid("unknown JSON protocol field".into())); } if additional.is_object() { shape(additional,field)?; } }
        }
    }
    if let Some(values) = value.as_array() {
        if let Some(minimum) = schema.get("minItems").and_then(Value::as_u64) { require(values.len() as u64 >= minimum,"too few array items")?; }
        if let Some(items) = schema.get("items") { for item in values { shape(items,item)?; } }
    }
    if let Some(text) = value.as_str() {
        if let Some(minimum) = schema.get("minLength").and_then(Value::as_u64) { require(text.chars().count() as u64 >= minimum,"string is too short")?; }
        if let Some(maximum) = schema.get("maxLength").and_then(Value::as_u64) { require(text.chars().count() as u64 <= maximum,"string is too long")?; }
        if let Some(pattern) = schema.get("pattern").and_then(Value::as_str) { match pattern { "^[0-9a-f]{64}$" => valid_hash(text)?,"^[A-Za-z0-9_.-]+$" => valid_id(text)?,_ => return Err(Error::Invalid("unsupported schema pattern".into())) } }
    }
    if let Some(number) = value.as_f64() {
        if let Some(minimum) = schema.get("minimum").and_then(Value::as_f64) { require(number >= minimum,"number below protocol minimum")?; }
        if let Some(maximum) = schema.get("maximum").and_then(Value::as_f64) { require(number <= maximum,"number above protocol maximum")?; }
    }
    Ok(())
}
pub fn validate(kind: &str, value: &Value) -> Result<()> {
    shape(&export(kind)?,value)?;
    match kind {
        "contract" => crate::lifecycle::validate_contract(&serde_json::from_value::<Contract>(value.clone())?)?,
        "evidence" => { let _:Evidence = serde_json::from_value(value.clone())?; },
        "decision" => { let _:Decision = serde_json::from_value(value.clone())?; },
        "adoption" => { let _:Adoption = serde_json::from_value(value.clone())?; },
        "learning" => { let _:Learning = serde_json::from_value(value.clone())?; },
        "action" => { let action:ActionRequest = serde_json::from_value(value.clone())?; absolute(&action.executable)?; absolute(&action.cwd)?; },
        _ => return Err(Error::Invalid("unknown schema kind".into())),
    } Ok(())
}
