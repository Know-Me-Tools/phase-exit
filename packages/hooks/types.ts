export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type JsonObject = { [key: string]: Json };
export const EVENTS = ["contract.collected", "contract.frozen", "evidence.imported", "evaluation.before", "judgement.received", "decision.finalized", "amendment.proposed"] as const;
export type HookEvent = typeof EVENTS[number];
export interface HookDefinition {
  id: string;
  event: HookEvent;
  module: string;
  sha256: string;
  input_schema: "phase-exit/hook-input/v1";
  output_schema: "phase-exit/hook-output/v1";
  timeout_ms: number;
  required: boolean;
  env_allowlist: string[];
}
export interface HookContext {
  schema_version: 1;
  config_path: string;
  config_base_dir?: string;
  config_sha256: string;
  state_dir: string;
  invocation_id: string;
  payload: JsonObject;
}
export interface HookInput {
  schema_version: 1;
  event: HookEvent;
  invocation_id: string;
  payload: JsonObject;
}
export interface HookOutput {
  schema_version: 1;
  veto: boolean;
  reason: string;
  evidence_proposals: JsonObject[];
  amendment_proposals: JsonObject[];
}
export interface HookReceipt {
  id: string;
  status: "ok" | "veto" | "failed";
  required: boolean;
  message: string;
}
export interface HookRunResult {
  schema_version: 1;
  event: HookEvent;
  blocked: boolean;
  results: HookReceipt[];
  evidence_proposals: JsonObject[];
  amendment_proposals: JsonObject[];
}
