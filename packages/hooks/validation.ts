import { isAbsolute } from "node:path";
import { object, strictKeys, string } from "./json.js";
import { EVENTS } from "./types.js";
import type { HookContext, HookDefinition, HookEvent, HookOutput, JsonObject } from "./types.js";

export function eventName(value: unknown): HookEvent {
  for (const name of EVENTS) if (name === value) return name;
  throw new Error("Unknown hook event");
}
function hash(value: unknown): string {
  const result = string(value, "sha256");
  if (!/^[a-f0-9]{64}$/.test(result)) throw new Error("Invalid sha256");
  return result;
}
function absolute(value: unknown): string {
  const result = string(value, "absolute path");
  if (!isAbsolute(result)) throw new Error("Absolute path required");
  return result;
}
export function context(value: unknown): HookContext {
  if (!object(value) || value["schema_version"] !== 1 || !object(value["payload"])) throw new Error("Invalid hook context");
  strictKeys(value, ["schema_version", "config_path", "config_base_dir", "config_sha256", "state_dir", "invocation_id", "payload"]);
  return { schema_version: 1, config_path: absolute(value["config_path"]), ...(value["config_base_dir"] === undefined ? {} : { config_base_dir: absolute(value["config_base_dir"]) }), config_sha256: hash(value["config_sha256"]), state_dir: absolute(value["state_dir"]), invocation_id: string(value["invocation_id"], "invocation id"), payload: value["payload"] };
}
export function configuration(value: unknown): HookDefinition[] {
  if (!object(value) || value["schema_version"] !== 1 || !Array.isArray(value["hooks"]) || value["hooks"].length > 64) throw new Error("Invalid hook configuration");
  strictKeys(value, ["schema_version", "hooks"]);
  const ids = new Set<string>();
  return value["hooks"].map(item => {
    if (!object(item)) throw new Error("Invalid hook entry");
    strictKeys(item, ["id", "event", "module", "sha256", "input_schema", "output_schema", "timeout_ms", "required", "env_allowlist"]);
    if (item["input_schema"] !== "phase-exit/hook-input/v1" || item["output_schema"] !== "phase-exit/hook-output/v1") throw new Error("Unsupported hook schema");
    const id = string(item["id"], "hook id");
    if (ids.has(id)) throw new Error("Duplicate hook id");
    ids.add(id);
    const timeout = item["timeout_ms"];
    const required = item["required"];
    const env = item["env_allowlist"];
    if (typeof timeout !== "number" || !Number.isInteger(timeout) || timeout < 1 || timeout > 60_000 || typeof required !== "boolean" || !Array.isArray(env)) throw new Error("Invalid hook limits");
    return { id, event: eventName(item["event"]), module: string(item["module"], "module"), sha256: hash(item["sha256"]), input_schema: "phase-exit/hook-input/v1", output_schema: "phase-exit/hook-output/v1", timeout_ms: timeout, required, env_allowlist: env.map(entry => {
      const name = string(entry, "environment name");
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error("Invalid environment name");
      return name;
    }) };
  });
}
export function output(value: unknown): HookOutput {
  if (!object(value) || value["schema_version"] !== 1) throw new Error("Invalid hook result");
  strictKeys(value, ["schema_version", "veto", "reason", "evidence_proposals", "amendment_proposals"]);
  if (value["veto"] !== undefined && typeof value["veto"] !== "boolean") throw new Error("Invalid veto");
  if (value["reason"] !== undefined && typeof value["reason"] !== "string") throw new Error("Invalid reason");
  function proposals(key: string): JsonObject[] {
    const list = value && object(value) ? value[key] : undefined;
    if (list === undefined) return [];
    if (!Array.isArray(list) || list.length > 64 || !list.every(object)) throw new Error("Invalid proposals");
    return list;
  }
  return { schema_version: 1, veto: value["veto"] === true, reason: typeof value["reason"] === "string" ? value["reason"] : "", evidence_proposals: proposals("evidence_proposals"), amendment_proposals: proposals("amendment_proposals") };
}
