import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { randomUUID } from "node:crypto";
import { digest, MAX_BYTES, object, parse, readBounded, strictKeys, string } from "../hooks/json.js";
import type { Json, JsonObject } from "../hooks/types.js";

export type Verdict = "COMPLETE" | "CONTINUE" | "WAIT" | "BLOCKED" | "REVIEW_REQUIRED" | "INVALID";
export interface Decision {
  schema_version: 1;
  decision_id: string;
  contract_digest: string;
  evaluated_stage: string;
  verdict: Verdict;
  stage_complete: boolean;
  phase_complete: boolean;
  unmet_criteria: string[];
  evidence_refs: string[];
  reasons: { code: string; criterion_id: string | null; message: string }[];
  next_authorized_action: { id: string; kind: string } | null;
}
export interface ActionRequest {
  schema_version: 1;
  action_id: string;
  kind: "gate" | "implementation" | "publication" | "repair";
  executable: string;
  argv: string[];
  cwd: string;
}
export interface Binding { tool_name: string; input_sha256: string; request: ActionRequest }
export interface BridgeConfig {
  binary: string;
  contract: string;
  evidence: string;
  stage: string;
  state_dir: string;
  bindings: Binding[];
}
function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((entry: unknown): entry is string => typeof entry === "string")) throw new Error("Invalid string array");
  return value;
}
function path(value: unknown): string {
  const result = string(value, "path");
  if (!isAbsolute(result)) throw new Error("Absolute path required");
  return result;
}
function request(value: unknown): ActionRequest {
  if (!object(value) || value["schema_version"] !== 1) throw new Error("Invalid action request");
  strictKeys(value, ["schema_version", "action_id", "kind", "executable", "argv", "cwd"]);
  const kind = value["kind"];
  if (kind !== "gate" && kind !== "implementation" && kind !== "publication" && kind !== "repair") throw new Error("Invalid action kind");
  return { schema_version: 1, action_id: string(value["action_id"], "action id"), kind, executable: path(value["executable"]), argv: strings(value["argv"]), cwd: path(value["cwd"]) };
}
export async function loadConfig(): Promise<BridgeConfig> {
  if (process.env["PHASE_EXIT_HOOK_ACTIVE"]) throw new Error("Recursive evaluation forbidden");
  let config: JsonObject = {};
  if (process.env["PHASE_EXIT_CONFIG"]) {
    const raw = parse(await readBounded(process.env["PHASE_EXIT_CONFIG"]));
    if (!object(raw) || raw["schema_version"] !== 1) throw new Error("Invalid adapter config");
    strictKeys(raw, ["schema_version", "binary", "contract", "evidence", "stage", "state_dir", "bindings"]);
    config = raw;
  }
  const bindings = config["bindings"] ?? [];
  if (!Array.isArray(bindings)) throw new Error("Invalid tool bindings");
  return {
    binary: path(process.env["PHASE_EXIT_BINARY"] ?? config["binary"]),
    contract: path(process.env["PHASE_EXIT_CONTRACT"] ?? config["contract"]),
    evidence: path(process.env["PHASE_EXIT_EVIDENCE"] ?? config["evidence"]),
    stage: string(process.env["PHASE_EXIT_STAGE"] ?? config["stage"], "stage"),
    state_dir: path(process.env["PHASE_EXIT_STATE_DIR"] ?? config["state_dir"]),
    bindings: bindings.map(binding => {
      if (!object(binding)) throw new Error("Invalid binding");
      strictKeys(binding, ["tool_name", "input_sha256", "request"]);
      const inputHash = string(binding["input_sha256"], "input digest");
      if (!/^[0-9a-f]{64}$/.test(inputHash)) throw new Error("Invalid input digest");
      return { tool_name: string(binding["tool_name"], "tool name"), input_sha256: inputHash, request: request(binding["request"]) };
    }),
  };
}
export function parseDecision(value: unknown): Decision {
  if (!object(value) || value["schema_version"] !== 1) throw new Error("Invalid decision");
  const verdict = value["verdict"];
  if (verdict !== "COMPLETE" && verdict !== "CONTINUE" && verdict !== "WAIT" && verdict !== "BLOCKED" && verdict !== "REVIEW_REQUIRED" && verdict !== "INVALID") throw new Error("Invalid verdict");
  if (typeof value["stage_complete"] !== "boolean" || typeof value["phase_complete"] !== "boolean") throw new Error("Invalid completion flags");
  if (value["phase_complete"] && (!value["stage_complete"] || verdict !== "COMPLETE")) throw new Error("Conflicting completion flags");
  const next = value["next_authorized_action"];
  let action: Decision["next_authorized_action"] = null;
  if (next !== null) {
    if (!object(next)) throw new Error("Invalid next action");
    action = { id: string(next["id"], "action id"), kind: string(next["kind"], "action kind") };
  }
  const reasons = value["reasons"];
  if (!Array.isArray(reasons)) throw new Error("Invalid reasons");
  return {
    schema_version: 1, decision_id: string(value["decision_id"], "decision id"), contract_digest: string(value["contract_digest"], "contract digest"), evaluated_stage: string(value["evaluated_stage"], "stage"), verdict,
    stage_complete: value["stage_complete"], phase_complete: value["phase_complete"], unmet_criteria: strings(value["unmet_criteria"]), evidence_refs: strings(value["evidence_refs"]),
    reasons: reasons.map(reason => {
      if (!object(reason) || !(reason["criterion_id"] === null || typeof reason["criterion_id"] === "string")) throw new Error("Invalid reason");
      return { code: string(reason["code"], "reason code"), criterion_id: reason["criterion_id"], message: string(reason["message"], "reason message") };
    }), next_authorized_action: action,
  };
}
export async function invoke(config: BridgeConfig, args: string[]): Promise<{ code: number; value: unknown }> {
  return new Promise((resolveResult, reject) => {
    // Only Rust receives the process credential. User extensions are stripped by Rust and Node.
    const env = { ...process.env };
    delete env["NODE_OPTIONS"];
    const child = spawn(config.binary, args, { shell: false, env, stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
    const chunks: Buffer[] = [];
    let size = 0;
    let failed = false;
    const timer = setTimeout(() => fail(), 120_000);
    function fail(): void {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      reject(new Error("Phase Exit process failed, timed out or exceeded output bound"));
    }
    child.once("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) fail();
      else chunks.push(chunk);
    });
    child.once("close", code => {
      clearTimeout(timer);
      if (failed) return;
      try {
        if (code === null) throw new Error("Process terminated");
        resolveResult({ code, value: parse(Buffer.concat(chunks)) });
      } catch { reject(new Error("Phase Exit returned invalid JSON")); }
    });
  });
}
export async function evaluate(config: BridgeConfig): Promise<Decision> {
  const response = await invoke(config, ["evaluate", "--contract", config.contract, "--evidence", config.evidence, "--stage", config.stage, "--state-dir", config.state_dir]);
  const decision = parseDecision(response.value);
  const expected: Record<Verdict, number> = { COMPLETE: 0, CONTINUE: 10, WAIT: 11, BLOCKED: 12, REVIEW_REQUIRED: 13, INVALID: 14 };
  if (response.code !== expected[decision.verdict]) throw new Error("Decision and exit code disagree");
  return decision;
}
export function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`).join(",")}}`;
  return JSON.stringify(value);
}
export function actionableFingerprint(decision: Decision): string {
  return digest(canonical({ contract_digest: decision.contract_digest, stage: decision.evaluated_stage, verdict: decision.verdict, next: decision.next_authorized_action, unmet: [...decision.unmet_criteria].sort(), evidence: [...decision.evidence_refs].sort() }));
}
export interface StopOutcome { decision: Decision; request_continuation: boolean; message: string }
export async function handleStop(config: BridgeConfig, session: string, stopHookActive: boolean): Promise<StopOutcome> {
  const decision = await evaluate(config);
  const message = decision.phase_complete ? "Phase Exit: phase complete." : `Phase Exit: ${decision.verdict}; phase incomplete. Stage: ${decision.evaluated_stage}. ${decision.reasons.map(reason => reason.message).join(" ")}`;
  const actionable = !stopHookActive && !decision.phase_complete && (decision.verdict === "CONTINUE" || decision.verdict === "COMPLETE") && decision.next_authorized_action !== null;
  if (!actionable) return { decision, request_continuation: false, message };
  const directory = join(config.state_dir, "continuations", digest(session));
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(join(directory, `${actionableFingerprint(decision)}.json`), JSON.stringify({ schema_version: 1, decision_id: decision.decision_id, next_authorized_action: decision.next_authorized_action }), { flag: "wx", mode: 0o600 });
    return { decision, request_continuation: true, message: `${message} Next approved action: ${decision.next_authorized_action?.id}. Follow the adopted plan.` };
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EEXIST") return { decision, request_continuation: false, message: `${message} Continuation already requested for this evidence and action.` };
    throw error;
  }
}
export async function authorizeTool(config: BridgeConfig, toolName: string, input: Json, cwd: string): Promise<{ allowed: boolean; reason: string }> {
  const inputHash = digest(canonical(input));
  const binding = config.bindings.find(item => item.tool_name === toolName && item.input_sha256 === inputHash);
  const commandSurface = /bash|shell|exec|command|terminal|run_code/i.test(toolName) || (object(input) && ("command" in input || "cmd" in input || "executable" in input));
  if (!binding) return commandSurface ? { allowed: false, reason: "Phase Exit: command tool has no exact operator-reviewed binding to an adopted action." } : { allowed: true, reason: "Tool outside configured command enforcement coverage." };
  if (cwd !== binding.request.cwd) return { allowed: false, reason: "Phase Exit: tool working directory differs from adopted action." };
  const directory = join(config.state_dir, "action-requests");
  await mkdir(directory, { recursive: true });
  const requestPath = join(directory, `${randomUUID()}.json`);
  await writeFile(requestPath, JSON.stringify(binding.request), { flag: "wx", mode: 0o600 });
  const response = await invoke(config, ["action", "authorize", "--contract", config.contract, "--evidence", config.evidence, "--request", requestPath, "--state-dir", config.state_dir]);
  if (!object(response.value) || response.value["schema_version"] !== 1 || typeof response.value["authorized"] !== "boolean" || response.value["action_id"] !== binding.request.action_id || typeof response.value["reason"] !== "string") throw new Error("Invalid authorization result");
  parseDecision(response.value["decision"]);
  if (response.code !== (response.value["authorized"] ? 0 : 12)) throw new Error("Authorization exit disagrees");
  return { allowed: response.value["authorized"], reason: response.value["reason"] };
}
