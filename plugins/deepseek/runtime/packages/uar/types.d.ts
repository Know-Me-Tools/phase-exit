export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
export type ObjectValue = {
    [key: string]: Json;
};
export type Result<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
export type SourceRole = 'assessment' | 'analysis' | 'specification' | 'plan' | 'evidence' | 'configuration';
export interface Source {
    id: string;
    path: string;
    sha256: string;
    role: SourceRole;
}
export interface Criterion {
    id: string;
    stage: string;
    description: string;
    source_id: string;
    depends_on: string[];
    expected_outcome: string;
    predicate: {
        kind: 'json_equals';
        pointer: string;
        expected: Json;
    } | {
        kind: 'external_ready';
        pointer: string;
    } | {
        kind: 'command_success';
        action_id: string;
    };
}
export interface Action {
    id: string;
    kind: 'gate';
    stage: string;
    executable: string;
    argv: string[];
    cwd: string;
    repairs_criteria: string[];
    covers_criteria: string[];
}
export interface Operation {
    id: string;
    action_id: string;
    state: 'running';
    started_at: number;
    expires_at: number;
}
export interface Contract {
    schema_version: 1;
    id: string;
    revision: number;
    parent_digest: string | null;
    project: string;
    phase: string;
    exclusions: string[];
    prerequisites: string[];
    boundary: {
        implementation_stages: string[];
    };
    retry_limits: {
        max_attempts: number;
        max_elapsed_seconds: number;
    };
    jev: {
        model: 'jev-1.14.0';
        rubric_version: 'phase-exit-v1';
        support_threshold: 0.95;
        contradiction_threshold: 0.05;
    };
    conflicts: {
        id: string;
        criterion_ids: string[];
        resolution: string | null;
        source_id: string;
    }[];
    identity: Record<string, string>;
    sources: Source[];
    stages: {
        id: string;
        kind: 'implementation' | 'gate' | 'publication';
        depends_on: string[];
    }[];
    criteria: Criterion[];
    actions: Action[];
    hooks: {
        config_path: string;
        config_sha256: string;
    };
}
export interface EvidenceRecord {
    id: string;
    criterion_id: string;
    contract_digest: string;
    identity: Record<string, string>;
    artifact_path: string;
    artifact_sha256: string;
    captured_at: number;
    expires_at: null;
    supersedes: null;
    origin: {
        runner: string;
        config_sha256: string;
        platform: string;
        artifact_identity: Record<string, string>;
    };
    operation: Operation | null;
}
export interface Evidence {
    schema_version: 1;
    contract_digest: string;
    records: EvidenceRecord[];
}
export interface ReceiptInput {
    manifest: string;
    receipt: string;
}
export interface ImportOptions {
    root: string;
    output: string;
    receipts?: readonly ReceiptInput[];
    adoptionReference?: string;
    activeOperationObservation?: string;
}
export interface ImportOutput {
    contract: string;
    evidence: string;
    adoptionMap: string;
    snapshot: string;
    contractDigest: string;
    status: 'draft_requires_operator_adoption';
    implementationItems: number;
    imageScenarios: number;
    nativeSupplements: number;
    warnings: string[];
}
