/** Source transcription: UAR scripts/release/uar_1_1_1_{runtime,credentials,recovery}.py. */
export declare const PHASE = "uar-outstanding-issues-v1-1-1";
export declare const PHASE_PATH = ".kbd-orchestrator/phases/uar-outstanding-issues-v1-1-1";
export declare const GROUPS: readonly ['binding', 'streams', 'mcp-outcomes', 'credentials', 'recovery', 'combined'];
export type Group = (typeof GROUPS)[number];
export declare const IMAGE_SCENARIOS: Readonly<Record<Group, readonly string[]>>;
export declare const NATIVE_SUPPLEMENTS: readonly [{
    readonly group: 'binding';
    readonly target: 'bauar_full_harness_cursor';
    readonly case: 'phase_runtime_binding_refusals_use_real_host_store_and_provider';
}, {
    readonly group: 'mcp-outcomes';
    readonly target: 'bauar_full_harness_cursor';
    readonly case: 'phase_runtime_native_incidental_error_retains_success';
}, {
    readonly group: 'credentials';
    readonly target: 'credentials_api_integration_test';
    readonly case: 'phase_native_sdk_supplied_credentials_use_real_provider_and_durable_store';
}, {
    readonly group: 'credentials';
    readonly target: 'credentials_api_integration_test';
    readonly case: 'phase_memory_credential_migration_uses_real_http_and_atomic_store';
}];
export declare const SOURCE_PATHS: readonly ['src', 'Cargo.toml', 'Cargo.lock', 'build.rs', 'Dockerfile', 'migrations', 'policies', 'versions.toml', 'proto', 'static', 'catalog', 'package.json', 'pnpm-lock.yaml', 'vendor', 'crates', 'frontend', 'docs/agents', 'scripts', '.cargo', '.dockerignore', '.gitmodules', 'rust-toolchain.toml'];
export declare const FIXTURE_PATHS: readonly ['tests', 'scripts/release'];
