import type { Json } from "../hooks/types.js";
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
    reasons: {
        code: string;
        criterion_id: string | null;
        message: string;
    }[];
    next_authorized_action: {
        id: string;
        kind: string;
    } | null;
}
export interface ActionRequest {
    schema_version: 1;
    action_id: string;
    kind: "gate" | "implementation" | "publication" | "repair";
    executable: string;
    argv: string[];
    cwd: string;
}
export interface Binding {
    tool_name: string;
    input_sha256: string;
    request: ActionRequest;
}
export interface BridgeConfig {
    binary: string;
    contract: string;
    evidence: string;
    stage: string;
    state_dir: string;
    bindings: Binding[];
}
export declare function loadConfig(): Promise<BridgeConfig>;
export declare function parseDecision(value: unknown): Decision;
export declare function invoke(config: BridgeConfig, args: string[]): Promise<{
    code: number;
    value: unknown;
}>;
export declare function evaluate(config: BridgeConfig): Promise<Decision>;
export declare function canonical(value: Json): string;
export declare function actionableFingerprint(decision: Decision): string;
export interface StopOutcome {
    decision: Decision;
    request_continuation: boolean;
    message: string;
}
export declare function handleStop(config: BridgeConfig, session: string, stopHookActive: boolean): Promise<StopOutcome>;
export declare function authorizeTool(config: BridgeConfig, toolName: string, input: Json, cwd: string): Promise<{
    allowed: boolean;
    reason: string;
}>;
