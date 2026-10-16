/** Source transcription: UAR scripts/release/uar_1_1_1_{runtime,credentials,recovery}.py. */
export const PHASE = 'uar-outstanding-issues-v1-1-1';
export const PHASE_PATH = `.kbd-orchestrator/phases/${PHASE}`;
export const GROUPS = ['binding', 'streams', 'mcp-outcomes', 'credentials', 'recovery', 'combined'] as const;
export type Group = (typeof GROUPS)[number];
const migrationCases = [
  'metadata-upgrade', 'preview-authority-pagination', 'legacy-conditional-copy',
  'fixed-local-conditional-copy', 'revision-drift', 'mapping-drift', 'destination-conflict',
  'concurrent-replay', 'lost-response-retry', 'immutable-rotation-deletion-restart',
  'historical-receipt', 'preview-status-inventory', 'secret-redaction',
] as const;
export const IMAGE_SCENARIOS: Readonly<Record<Group, readonly string[]>> = {
  binding: ['binding-qualified-durable-control', 'binding-unattested-refusal',
    'binding-16000-catalog-reservation-refusal', 'binding-v1-messages-policy',
    'binding-shared-alias-and-credential-free', 'binding-fallback-policy',
    'binding-timeout-inheritance', 'binding-team-source-policy',
    'binding-summary-capture-policy', 'binding-invalid-budget-refusal'],
  streams: ['streams-native-partition-matrix', 'streams-sse-fields-fixed-partitions',
    'streams-eof-matrix', 'streams-invalid-matrix', 'streams-tool-terminal-control',
    'streams-cancel-cleanup', 'streams-graph-inherited-control'],
  'mcp-outcomes': ['mcp-application-error', 'mcp-explicit-success-and-omitted-status',
    'mcp-protocol-and-timeout', 'mcp-uncertain-effect-preserved'],
  credentials: ['identity-isolation', 'local-installation-stability', 'shared-source-grants',
    'absent-service-policy', 'store-decrypt-failures', 'single-owner-compatibility',
    'local-quarantine', 'messages-facade-policy', 'response-correction-policy',
    ...['local', 'surreal', 'postgres'].flatMap(backend => migrationCases.map(id => `${backend}-${id}`))],
  recovery: ['unattested_remote_upload_refusal', 'attested_upload_restart_owner_isolation',
    'legacy_principal_namespace_cold_readback', 'joined_quiesce_reclaim_controls',
    'qualified_supervisor_reclaim_controls'],
  combined: ['combined-failed-tool-incomplete-stream', 'combined-valid-control'],
};
export const NATIVE_SUPPLEMENTS = [
  { group: 'binding', target: 'bauar_full_harness_cursor', case: 'phase_runtime_binding_refusals_use_real_host_store_and_provider' },
  { group: 'mcp-outcomes', target: 'bauar_full_harness_cursor', case: 'phase_runtime_native_incidental_error_retains_success' },
  { group: 'credentials', target: 'credentials_api_integration_test', case: 'phase_native_sdk_supplied_credentials_use_real_provider_and_durable_store' },
  { group: 'credentials', target: 'credentials_api_integration_test', case: 'phase_memory_credential_migration_uses_real_http_and_atomic_store' },
] as const;
export const SOURCE_PATHS = ['src', 'Cargo.toml', 'Cargo.lock', 'build.rs', 'Dockerfile',
  'migrations', 'policies', 'versions.toml', 'proto', 'static', 'catalog', 'package.json',
  'pnpm-lock.yaml', 'vendor', 'crates', 'frontend', 'docs/agents', 'scripts', '.cargo',
  '.dockerignore', '.gitmodules', 'rust-toolchain.toml'] as const;
export const FIXTURE_PATHS = ['tests', 'scripts/release'] as const;
