import { readFile, mkdir, writeFile, realpath, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname, join, basename, delimiter, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, sourceIdentity, contained } from './freshness.js';
import { PHASE, PHASE_PATH, GROUPS, IMAGE_SCENARIOS, NATIVE_SUPPLEMENTS, SOURCE_PATHS, FIXTURE_PATHS } from './scenarios.js';
import type { Action, Contract, Criterion, Evidence, ImportOptions, ImportOutput, Json, ObjectValue, Operation, ReceiptInput, Result, Source, SourceRole } from './types.js';

function obj(value: Json | undefined): ObjectValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('EXPECTED_OBJECT');
  return value;
}
function arr(value: Json | undefined): Json[] {
  if (!Array.isArray(value)) throw new Error('EXPECTED_ARRAY');
  return value;
}
function str(value: Json | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error('EXPECTED_NONEMPTY_STRING');
  return value;
}
function optionalObject(value: Json | undefined): ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
function list(value: Json | undefined): Json[] { return Array.isArray(value) ? value : []; }
function json(value: unknown): Json {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(json);
  if (typeof value === 'object' && value !== null) {
    const output: ObjectValue = {};
    for (const [key, item] of Object.entries(value)) output[key] = json(item);
    return output;
  }
  throw new Error('INVALID_JSON_VALUE');
}
export function canonicalJson(value: unknown): string {
  function ordered(entry: Json): Json {
    if (Array.isArray(entry)) return entry.map(ordered);
    if (entry !== null && typeof entry === 'object') {
      return Object.fromEntries(Object.keys(entry).sort().map(key => [key, ordered(entry[key] ?? null)]));
    }
    return entry;
  }
  return JSON.stringify(ordered(json(value)));
}
function equal(a: unknown, b: unknown): boolean { return canonicalJson(a) === canonicalJson(b); }
function prefixed(bytes: Uint8Array): string { return `sha256:${sha256(bytes)}`; }
function idsEqual(values: readonly string[], required: readonly string[]): boolean {
  return values.length === required.length && new Set(values).size === values.length && [...values].sort().join('\0') === [...required].sort().join('\0');
}
interface Captured { source: Source; bytes: Buffer; original: string; value: Json | null }
interface ImportedReceipt {
  manifest: ObjectValue; receipt: ObjectValue; manifestSource: Source; receiptSource: Source;
  originalManifest: string; originalReceipt: string;
  current: boolean; identityValid: boolean; rawValid: boolean; complete: boolean;
  rawArtifacts: { path: string; expected: string; actual: string }[];
  publication: ObjectValue | null; publicationValid: boolean;
}
async function locateApprovedPython(): Promise<string> {
  for (const entry of (process.env['PATH'] ?? '').split(delimiter)) {
    if (!entry || !isAbsolute(entry)) continue;
    const candidate = join(entry, 'python3');
    try { await access(candidate, constants.X_OK); return await realpath(candidate); }
    catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && ['ENOENT', 'EACCES', 'ENOTDIR'].includes(String(error.code))) continue;
      throw error;
    }
  }
  throw new Error('APPROVED_PYTHON_EXECUTABLE_NOT_FOUND');
}

/** Reads UAR and writes a NEW private snapshot directory only. Never invokes a product gate. */
export async function importUarSnapshot(options: ImportOptions): Promise<Result<ImportOutput>> {
  try { return { ok: true, value: await collect(options) }; }
  catch (error: unknown) {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message) ? error.message : 'IMPORT_FAILED';
    return { ok: false, error: { code, message: 'Read-only import did not complete. Original UAR files were not modified; inspect inputs and use a fresh output directory.' } };
  }
}

async function collect(options: ImportOptions): Promise<ImportOutput> {
  const root = await realpath(resolve(options.root));
  const output = join(await realpath(dirname(resolve(options.output))), basename(resolve(options.output)));
  if (contained(root, output) || contained(output, root)) throw new Error('OUTPUT_MUST_BE_OUTSIDE_UAR');
  const captured: Captured[] = [];
  const sources: Source[] = [];
  const historyPaths = new Set<string>();
  async function capture(id: string, path: string, parse = true, role: SourceRole = 'evidence'): Promise<Captured> {
    const original = await realpath(path);
    const bytes = await readFile(original);
    const source = { id, path: join(output, 'sources', `${id}${parse ? '.json' : '.txt'}`), sha256: sha256(bytes), role };
    const item = { source, bytes, original, value: parse ? json(JSON.parse(bytes.toString('utf8'))) : null };
    captured.push(item); sources.push(source); return item;
  }
  async function preserveParent(value: ObjectValue): Promise<void> {
    const reference = optionalObject(value.repair_parent);
    if (Object.keys(reference).length === 0) return;
    const path = await realpath(str(reference.path));
    if (historyPaths.has(path)) return;
    historyPaths.add(path);
    const parent = await capture(`historical-parent-${historyPaths.size}`, path);
    if (prefixed(parent.bytes) !== reference.digest) throw new Error('HISTORICAL_PARENT_CHANGED');
    await preserveParent(obj(parent.value));
  }
  const waypoint = await capture('waypoint', join(root, '.kbd-orchestrator/current-waypoint.json'));
  if (obj(waypoint.value).activePhaseId !== PHASE) throw new Error('WRONG_ACTIVE_UAR_PHASE');
  const inventoryCapture = await capture('inventory03', join(root, PHASE_PATH, 'implementation-inventory-20261016-03.json'));
  const inventory = obj(inventoryCapture.value);
  const ledgerCapture = await capture('ledger', join(root, PHASE_PATH, 'execution-ledger.json'));
  const ledger = obj(ledgerCapture.value);
  for (const [id, role] of [['assessment', 'assessment'], ['analysis', 'analysis'], ['spec', 'specification'], ['plan', 'plan']] as const) {
    await capture(id, join(root, PHASE_PATH, `${id}.md`), false, role);
  }
  for (const [id, path] of [
    ['goals', `${PHASE_PATH}/goals.md`],
    ['tasks', `${PHASE_PATH}/tasks.md`], ['issue385', `${PHASE_PATH}/issue-385-coverage.md`],
    ['acceptance-source', 'scripts/release/uar_1_1_1_acceptance.py'],
    ['support-source', 'scripts/release/uar_1_1_1_support.py'],
    ['runtime-source', 'scripts/release/uar_1_1_1_runtime.py'],
    ['credentials-source', 'scripts/release/uar_1_1_1_credentials.py'],
    ['recovery-source', 'scripts/release/uar_1_1_1_recovery.py'],
    ['acceptance-plan', `openspec/changes/${PHASE}/verification.md`],
  ] as const) await capture(id, join(root, path), false);
  const reviewRoot = join(root, '.agent-team/uar-core/reviews', PHASE);
  const review1 = await capture('review-round1', join(reviewRoot, 'round-1/findings.json'));
  const review2 = await capture('review-round2', join(reviewRoot, 'round-2/findings.json'));
  await capture('review-round2-packet', join(reviewRoot, 'round-2/packet.json'));
  await capture('review-round2-receipt', join(reviewRoot, 'round-2/receipt.md'), false);
  const items = arr(inventory.items).map(obj);
  const tasks = arr(ledger.tasks).map(obj).filter(task => task.kind === 'implementation');
  const itemIds = items.map(item => str(item.stable_id));
  const ledgerIds = tasks.map(task => str(task.stable_id));
  if (!idsEqual(itemIds, ledgerIds)) throw new Error('INVENTORY_LEDGER_ITEM_SET_MISMATCH');
  if (items.length !== 19 || inventory.implementation_item_count !== 17) throw new Error('ADOPTION_MAP_REQUIRES_REVISION');
  const approvedGroups = arr(obj(ledger.validation_scope).groups).map(str);
  if (!equal(approvedGroups, GROUPS)) throw new Error('UNAPPROVED_GROUP_SCOPE');
  const itemFiles: { path: string; sha256: string; actual: string }[] = [];
  const seenFiles = new Map<string, string>();
  const itemAssertions: { id: string; passed: boolean; files: string[] }[] = [];
  for (const item of items) {
    const files = arr(item.files).map(obj);
    let passed = item.implemented === true && arr(item.unresolved).length === 0 && files.length > 0;
    for (const file of files) {
      const rel = str(file.path); const expected = str(file.sha256);
      const path = await realpath(resolve(root, rel));
      if (!contained(root, path)) throw new Error('ITEM_FILE_ESCAPES_UAR');
      const actual = prefixed(await readFile(path));
      passed = passed && actual === expected;
      const prior = seenFiles.get(rel);
      if (prior !== undefined && prior !== expected) throw new Error('CONFLICTING_ITEM_HASHES');
      if (prior === undefined) { itemFiles.push({ path: rel, sha256: expected, actual }); seenFiles.set(rel, expected); }
    }
    itemAssertions.push({ id: str(item.stable_id), passed, files: files.map(file => str(file.path)) });
  }
  const sourceTree = await sourceIdentity(root, SOURCE_PATHS);
  const fixtureTree = await sourceIdentity(root, FIXTURE_PATHS);
  const currentTrees = sourceTree === inventory.source_tree && fixtureTree === inventory.fixture_tree;
  const inputs: ReceiptInput[] = options.receipts ? [...options.receipts] : [];
  if (options.receipts === undefined) {
    const gates = join(root, PHASE_PATH, 'evidence/gates');
    for (const name of (await readdir(gates)).filter(name => name.endsWith('.json')).sort()) {
      const manifest = obj(json(JSON.parse(await readFile(join(gates, name), 'utf8'))));
      inputs.push({ manifest: join(gates, name), receipt: join(str(manifest.evidence_root), 'receipt.json') });
    }
  }
  const receipts: ImportedReceipt[] = [];
  for (const [index, input] of inputs.entries()) {
    const manifestCapture = await capture(`manifest-${index}`, resolve(input.manifest));
    const receiptCapture = await capture(`receipt-${index}`, resolve(input.receipt));
    const manifest = obj(manifestCapture.value); const receipt = obj(receiptCapture.value);
    await preserveParent(manifest);
    await preserveParent(receipt);
    const invRef = obj(manifest.implementation_inventory);
    const invRaw = await capture(`receipt-inventory-${index}`, str(invRef.path));
    const boundInventory = obj(invRaw.value);
    const image = str(manifest.image); const platform = str(manifest.platform);
    let identityValid = manifest.schema_version === 1 && manifest.phase === PHASE && manifest.version === '1.1.1'
      && prefixed(invRaw.bytes) === invRef.digest && boundInventory.source_tree === manifest.source_tree
      && boundInventory.fixture_tree === manifest.fixture_tree
      && ['phase', 'source_commit', 'source_tree', 'fixture_tree', 'stage', 'image', 'platform'].every(key => receipt[key] === manifest[key])
      && (receipt.version === undefined || receipt.version === manifest.version)
      && ['local', 'published'].includes(str(manifest.stage)) && ['linux/arm64', 'linux/amd64'].includes(platform);
    const artifact = optionalObject(receipt.artifact);
    identityValid = identityValid && artifact.platform === platform && /^sha256:[a-f0-9]{64}$/.test(typeof artifact.image_id === 'string' ? artifact.image_id : '');
    if (manifest.stage === 'local') identityValid = identityValid && !image.includes('@');
    const current = invRef.digest === `sha256:${inventoryCapture.source.sha256}`
      && manifest.source_tree === inventory.source_tree && manifest.fixture_tree === inventory.fixture_tree
      && manifest.source_commit === inventory.source_commit && currentTrees;
    const rawArtifacts: ImportedReceipt['rawArtifacts'] = [];
    let rawValid = false;
    const hashesPath = join(dirname(receiptCapture.original), 'hashes.json');
    try {
      const hashesCapture = await capture(`raw-hashes-${index}`, hashesPath);
      const hashes = obj(hashesCapture.value);
      rawValid = Object.keys(hashes).length > 0 && hashes['receipt.json'] === `sha256:${receiptCapture.source.sha256}`;
      for (const [rel, expectedValue] of Object.entries(hashes)) {
        const path = await realpath(resolve(dirname(receiptCapture.original), rel));
        if (!contained(dirname(receiptCapture.original), path)) throw new Error('RAW_ARTIFACT_PATH_ESCAPE');
        const expected = str(expectedValue); const actual = prefixed(await readFile(path));
        rawArtifacts.push({ path, expected, actual }); rawValid = rawValid && expected === actual;
      }
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') rawValid = false;
      else throw error;
    }
    let publication: ObjectValue | null = null; let publicationValid = false;
    if (manifest.stage === 'published') {
      const reference = obj(manifest.publication_receipt);
      const publicationCapture = await capture(`publication-${index}`, str(reference.path));
      publication = obj(publicationCapture.value);
      const children = obj(publication.children);
      const provenance = optionalObject(artifact.publication_provenance);
      const exports = optionalObject(provenance.artifacts);
      publicationValid = prefixed(publicationCapture.bytes) === reference.digest
        && publication.schema_version === 1 && publication.repository === 'Prometheus-AGS/universal-agent-runtime'
        && publication.tag === 'v1.1.1' && publication.source_commit === manifest.source_commit
        && publication.index_digest === manifest.index_digest && receipt.index_digest === manifest.index_digest
        && idsEqual(Object.keys(children), ['linux/arm64', 'linux/amd64'])
        && image === `ghcr.io/prometheus-ags/universal-agent-runtime@${str(children[platform])}`
        && provenance.source_commit === manifest.source_commit && provenance.workflow_run_id === publication.workflow_run_id
        && provenance.workflow_run_attempt === publication.workflow_run_attempt
        && equal(provenance.receipt, reference)
        && ['linux/arm64', 'linux/amd64'].every(arch => {
          const child = optionalObject(exports[arch]);
          return /^sha256:[a-f0-9]{64}$/.test(typeof children[arch] === 'string' ? children[arch] : '')
            && child.child_digest === children[arch] && child.artifact_id === optionalObject(publication?.artifact_ids)[arch];
        });
      identityValid = identityValid && publicationValid;
    }
    const groups = list(manifest.groups).map(str);
    const complete = receipt.status === 'passed' && receipt.exit_code === 0 && typeof receipt.finished_at === 'number'
      && receipt.finished_at <= Date.now() / 1000 && !receipt.cleanup_error && idsEqual(groups, GROUPS)
      && idsEqual(Object.keys(optionalObject(receipt.groups)), GROUPS)
      && GROUPS.every(group => {
        const result = optionalObject(optionalObject(receipt.groups)[group]);
        const scenarios = list(optionalObject(result.result).scenarios).map(obj);
        return result.status === 'passed' && idsEqual(scenarios.map(value => str(value.id)), IMAGE_SCENARIOS[group])
          && scenarios.every(row => row.status === 'passed' && hasObservations(row.observations));
      });
    receipts.push({ manifest, receipt, manifestSource: manifestCapture.source, receiptSource: receiptCapture.source,
      originalManifest: manifestCapture.original, originalReceipt: receiptCapture.original,
      current, identityValid, rawValid, complete, rawArtifacts, publication, publicationValid });
  }
  const runnerExecutable = await locateApprovedPython();
  const actions: Action[] = [];
  for (const stage of ['local', 'published-arm64', 'published-amd64']) {
    const manifestName = stage === 'local' ? 'local.json' : stage === 'published-arm64' ? 'arm64.json' : 'amd64.json';
    const expectedPath = resolve(root, PHASE_PATH, 'evidence/gates', manifestName);
    const candidate = receipts.find(receipt => receipt.current && receipt.originalManifest === expectedPath);
    if (!candidate) continue;
    actions.push({ id: `uar-${stage}-acceptance`, kind: 'gate', stage, executable: runnerExecutable,
      argv: ['scripts/release/uar_1_1_1_acceptance.py', '--manifest', expectedPath], cwd: root, repairs_criteria: [],
      covers_criteria: [`${stage}-whole-program`,
        ...GROUPS.flatMap(group => IMAGE_SCENARIOS[group].map(scenario => `${stage}-${scenario}`)),
        ...(stage === 'local' ? NATIVE_SUPPLEMENTS.map(supplement => `native-${supplement.case}`) : [])] });
  }
  let active: { receipt: ImportedReceipt; operation: Operation; observedAt: number; observationSource: Source } | null = null;
  if (options.activeOperationObservation !== undefined) {
    const observationCapture = await capture('active-operation-observation', resolve(options.activeOperationObservation));
    const observation = obj(observationCapture.value);
    const now = Math.floor(Date.now() / 1000);
    const observedAt = observation.observed_at; const expiresAt = observation.expires_at;
    if (observation.schema_version !== 1 || observation.state !== 'running'
      || observation.runner !== 'codex-native-exec' || typeof observation.runner_session_id !== 'string'
      || !/^[0-9]+$/.test(observation.runner_session_id)
      || typeof observedAt !== 'number' || !Number.isSafeInteger(observedAt) || observedAt > now || now - observedAt > 300
      || typeof expiresAt !== 'number' || !Number.isSafeInteger(expiresAt) || expiresAt <= now || expiresAt > observedAt + 300
      || typeof observation.observation_reference !== 'string' || observation.observation_reference.trim() === '') throw new Error('INVALID_ACTIVE_OPERATION_OBSERVATION');
    const candidate = receipts.find(receipt => receipt.current && receipt.identityValid && receipt.manifest.stage === 'local'
      && receipt.manifestSource.sha256 === observation.manifest_sha256 && receipt.receiptSource.sha256 === observation.receipt_sha256);
    const action = actions.find(action => action.id === 'uar-local-acceptance');
    if (!candidate || !action || candidate.receipt.status !== 'started' || candidate.receipt.finished_at !== undefined
      || candidate.receipt.exit_code !== undefined || typeof candidate.receipt.started_at !== 'number'
      || candidate.receipt.started_at > observedAt || candidate.receipt.started_at < 0
      || observation.executable !== action.executable || observation.cwd !== action.cwd || !equal(observation.argv, action.argv)) {
      throw new Error('ACTIVE_OPERATION_IDENTITY_MISMATCH');
    }
    // The trusted host poll proves running; started JSON alone never creates WAIT.
    action.stage = 'local-operation';
    action.covers_criteria = [];
    active = { receipt: candidate, observedAt, observationSource: observationCapture.source, operation: {
      id: `uar-session-${observation.runner_session_id}`, action_id: action.id, state: 'running',
      started_at: Math.floor(candidate.receipt.started_at), expires_at: expiresAt,
    } };
  }
  const adoptionMap = {
    schema_version: 1, phase: PHASE, status: 'proposed_requires_explicit_operator_adoption',
    adoption_reference: options.adoptionReference ?? null,
    inventory_sha256: inventoryCapture.source.sha256, original_count: inventory.implementation_item_count,
    derived_count: items.length, item_ids: itemIds, scope_authority: 'plan Execute scope correction and ledger validation_scope',
    original_L3: items.find(item => item.stable_id === 'L3')?.required_deliverable ?? null,
    adopted_groups: [...GROUPS], image_scenarios: IMAGE_SCENARIOS,
    native_supplements: NATIVE_SUPPLEMENTS,
    resolutions: [
      'Derive implementation count from the exact inventory items and match the ledger implementation set. Do not rewrite original count17.',
      'Use six approved phase groups; obsolete seven-group L3 prose is retained as history, not an additional Kubo gate.',
      'Require all76 exact image scenarios for local and each published architecture, plus4 local native supplements. A single repaired group cannot establish a whole-stage pass.',
      'Preserve original review rounds and their actual source/provenance; cap exhausted. R8 was not independently rereviewed. No third review is authorized.',
      'Receipt imports bind raw bytes, manifest bytes and referenced inventory bytes; absent receipt version is recovered only from its explicit hash-bound manifest, never guessed.',
    ],
  };
  const warnings = [
    'Draft only: an explicit operator adoption record must approve this exact mapping and contract digest.',
    'Qualified supervisor remains unavailable; mandatory acceptance and release remain blocked.',
    'Original corrective review used weaker native fallback; canonical producer identity and distinct-family independence were not proven. R8 source is outside its reviewed tree.',
    'Imported receipts are historical snapshots. A started receipt is not a passing result. Recollect after the active UAR run finishes.',
  ];
  const snapshot = {
    schema_version: 1, root, source_paths: [...SOURCE_PATHS], fixture_paths: [...FIXTURE_PATHS],
    source_tree: inventory.source_tree, fixture_tree: inventory.fixture_tree,
    observed_source_tree: sourceTree, observed_fixture_tree: fixtureTree, item_files: itemFiles,
    inventory_path: `${PHASE_PATH}/implementation-inventory-20261016-03.json`,
    item_assertions: itemAssertions, inventory_sha256: inventoryCapture.source.sha256,
    active_operation: active === null ? null : { observation_sha256: active.observationSource.sha256,
      observed_at: active.observedAt, operation: active.operation, original_receipt: active.receipt.originalReceipt,
      receipt_sha256: active.receipt.receiptSource.sha256, manifest_sha256: active.receipt.manifestSource.sha256 },
    original_waypoint: obj(waypoint.value), receipts: receipts.map(receipt => ({
      original_manifest: receipt.originalManifest,
      manifest_sha256: receipt.manifestSource.sha256, receipt_sha256: receipt.receiptSource.sha256,
      source_tree: receipt.receipt.source_tree ?? null, fixture_tree: receipt.receipt.fixture_tree ?? null,
      status: receipt.receipt.status ?? null, current: receipt.current, identity_valid: receipt.identityValid,
      raw_valid: receipt.rawValid, all_groups_complete: receipt.complete, raw_artifacts: receipt.rawArtifacts,
    })), warnings,
  };
  const assertions: Record<string, Json> = {};
  const criteria: Criterion[] = [];
  function criterion(id: string, stage: string, description: string, source: string, passed: boolean): void {
    assertions[id] = { passed };
    criteria.push({ id, stage, description, source_id: source, depends_on: [], expected_outcome: description,
      predicate: { kind: 'json_equals', pointer: `/${id}/passed`, expected: true } });
  }
  criterion('inventory-boundary', 'implementation', 'Inventory03 complete and exact current production/fixture trees match the frozen inventory.', 'inventory03',
    inventory.implementation_complete === true && inventory.boundary === 'open' && currentTrees);
  criterion('adoption-map', 'implementation', 'Operator explicitly references adoption of the19-item/six-group mapping; Rust adoption of the exact contract is additionally mandatory.', 'plan',
    typeof options.adoptionReference === 'string' && options.adoptionReference.trim().length > 0);
  for (const item of itemAssertions) criterion(`implementation-${item.id}`, 'implementation', `All ${item.id} deliverable files match their inventory03 hashes.`, 'inventory03', item.passed);
  criterion('review-history', 'review', 'Retain original two review rounds, corrective dispositions and exhausted cap; this does not certify R8 or stronger judge independence.', 'plan',
    obj(review1.value).round === 1 && obj(review2.value).round === 2 && obj(review2.value).verdict === 'PASS'
    && typeof inventory.verification_note === 'string' && inventory.verification_note.includes('no new review claimed'));
  if (active !== null) criteria.push({ id: 'local-runner-operation', stage: 'local-operation',
    description: 'The already-approved existing local acceptance runner is observed running by the trusted native host; wait without restarting it.',
    source_id: 'acceptance-plan', depends_on: [], expected_outcome: 'The exact existing acceptance operation finishes and provides final retained evidence.',
    predicate: { kind: 'command_success', action_id: active.operation.action_id } });
  const candidates = (stage: string): ImportedReceipt[] => receipts.filter(receipt => receipt.current && receipt.identityValid && receipt.rawValid
    && receipt.complete && (stage === 'local' ? receipt.manifest.stage === 'local'
      : receipt.manifest.stage === 'published' && receipt.manifest.platform === `linux/${stage.replace('published-', '')}`));
  for (const stage of ['local', 'published-arm64', 'published-amd64']) {
    const selected = candidates(stage);
    criterion(`${stage}-whole-program`, stage, 'One complete current six-group program passed with exact artifact identity, retained raw evidence and clean exit; partial repaired groups cannot pass this criterion.', 'acceptance-source', selected.length > 0);
    for (const group of GROUPS) {
      for (const scenario of IMAGE_SCENARIOS[group]) {
        const passed = selected.some(candidate => {
          const result = objOrEmptyGroup(candidate, group);
          const scenarios = list(optionalObject(result.result).scenarios).map(obj);
          if (result.status !== 'passed' || !idsEqual(scenarios.map(value => str(value.id)), IMAGE_SCENARIOS[group])) return false;
          const row = scenarios.find(value => value.id === scenario);
          return row?.status === 'passed' && hasObservations(row?.observations);
        });
        criterion(`${stage}-${scenario}`, stage, `${group}: ${scenario} has passing observable evidence on the exact ${stage} image.`,
          group === 'credentials' ? 'credentials-source' : group === 'recovery' ? 'recovery-source' : 'runtime-source', passed);
      }
    }
    if (stage === 'local') for (const supplement of NATIVE_SUPPLEMENTS) {
      const passed = selected.some(candidate => list(objOrEmptyGroup(candidate, supplement.group).native_integration).map(obj)
        .some(row => row.case === supplement.case && row.target === supplement.target && row.status === 'passed'
          && equal(row.argv, ['cargo', 'test', '--locked', '--no-default-features', '--features',
            'server-full,postgres-backend,in-memory-backend', '--test', supplement.target, supplement.case, '--', '--exact', '--test-threads=1'])));
      criterion(`native-${supplement.case}`, stage, `Local native supplement ${supplement.case} must pass; it cannot substitute for image observations.`, 'acceptance-source', passed);
    }
  }
  const publicationPass = receipts.some(receipt => receipt.current && receipt.identityValid && receipt.rawValid && receipt.publicationValid);
  criterion('publication-provenance', 'artifact-publication', 'Annotated tag, source, workflow run/attempt and both exported child digests match the immutable index as observed by the published runner.', 'acceptance-source', publicationPass);
  assertions['qualified-supervisor'] = { available: false, reason: 'Genuine isolated qualified supervisor setup unavailable in the adopted source inventory; new evidence and explicit revision are required.' };
  criteria.push({ id: 'qualified-supervisor', stage: 'release', description: 'Genuine qualified supervisor positive proof remains mandatory and unavailable. No production mutation or fabricated qualification.', source_id: 'issue385', depends_on: [], expected_outcome: 'Genuine isolated qualified supervisor positive acceptance is available and hash-bound to both accepted published images.', predicate: { kind: 'external_ready', pointer: '/qualified-supervisor/available' } });
  criterion('release-readback', 'release', 'GitHub release readback binds both accepted child receipts and exact source/index identities.', 'ledger', false);
  const releaseCriterion = criteria.find(item => item.id === 'release-readback');
  if (releaseCriterion) releaseCriterion.depends_on = ['qualified-supervisor'];
  criterion('issue-readbacks', 'issues', 'Criterion-specific #380/#385 readbacks and #379/#383 reconciliation retain #382 external dependencies and customer limits.', 'ledger', false);
  criterion('phase-reflection', 'reflection', 'Append phase reflection and memory with plan-versus-delivery limits after release and issue readbacks.', 'ledger', false);
  const generated = new Map<string, string>();
  function addJson(name: string, value: unknown): Source {
    const bytes = `${JSON.stringify(value, null, 2)}\n`; generated.set(name, bytes);
    const source: Source = { id: name.replace(/\.json$/, ''), path: join(output, name), sha256: sha256(bytes), role: 'evidence' }; sources.push(source); return source;
  }
  addJson('adoption-map.json', adoptionMap);
  const snapshotSource = addJson('snapshot.json', snapshot);
  const assertionSource = addJson('assertions.json', assertions);
  const hookSource = await readFile(fileURLToPath(new URL('./freshness.js', import.meta.url)), 'utf8');
  const marker = /(['"])__PHASE_EXIT_UAR_SNAPSHOT_PATH__\1/g;
  if (!marker.test(hookSource)) throw new Error('COMPILED_FRESHNESS_HOOK_REQUIRED');
  marker.lastIndex = 0;
  const boundHook = hookSource.replace(marker, JSON.stringify(snapshotSource.path));
  generated.set('freshness-hook.mjs', boundHook);
  const hookConfig = { schema_version: 1, hooks: [{ id: 'uar-source-freshness', event: 'evaluation.before',
    module: join(output, 'freshness-hook.mjs'), sha256: sha256(boundHook), timeout_ms: 45000,
    input_schema: 'phase-exit/hook-input/v1', output_schema: 'phase-exit/hook-output/v1',
    required: true, env_allowlist: ['PATH', 'HOME', 'USERPROFILE', 'SYSTEMROOT', 'SystemRoot', 'PATHEXT', 'XDG_CONFIG_HOME'] }] };
  const hooksSource = addJson('hooks.json', hookConfig);
  const contract: Contract = {
    schema_version: 1, id: PHASE, revision: 1, parent_digest: null,
    project: 'universal-agent-runtime', phase: PHASE,
    exclusions: ['No UAR mutation or acceptance launch by importer', 'No know-me production mutation',
      'No cancelled Dot qualification revival', 'No immutable tag movement', 'No third UAR artifact review',
      'No customer recovery claim from isolated fixture evidence'],
    prerequisites: ['inventory-boundary', 'adoption-map'], boundary: { implementation_stages: ['implementation'] },
    retry_limits: { max_attempts: 3, max_elapsed_seconds: 60 },
    jev: { model: 'jev-1.14.0', rubric_version: 'phase-exit-v1', support_threshold: 0.95, contradiction_threshold: 0.05 },
    conflicts: [
      { id: 'inventory-count17-vs19', criterion_ids: ['inventory-boundary', 'adoption-map'], source_id: 'plan',
        resolution: 'Adopt all19 explicit inventory items matching the ledger implementation set; retain original numeric17 unchanged as stale historical metadata.' },
      { id: 'obsolete-seven-vs-approved-six', criterion_ids: ['adoption-map', 'local-whole-program', 'published-arm64-whole-program', 'published-amd64-whole-program'], source_id: 'plan',
        resolution: 'Adopt the six groups in the operator Execute scope correction and ledger validation_scope. Preserve obsolete L3 seven-group prose in the raw inventory.' },
    ],
    identity: { repository: 'Prometheus-AGS/universal-agent-runtime', phase: PHASE, version: '1.1.1', source_commit: str(inventory.source_commit),
      source_tree: str(inventory.source_tree), fixture_tree: str(inventory.fixture_tree),
      inventory_sha256: inventoryCapture.source.sha256, snapshot_sha256: snapshotSource.sha256 },
    sources, stages: [
      { id: 'implementation', kind: 'implementation', depends_on: [] },
      { id: 'review', kind: 'gate', depends_on: ['implementation'] },
      ...(active === null ? [] : [{ id: 'local-operation', kind: 'gate' as const, depends_on: ['review'] }]),
      { id: 'local', kind: 'gate', depends_on: [active === null ? 'review' : 'local-operation'] },
      { id: 'artifact-publication', kind: 'publication', depends_on: ['local'] },
      { id: 'published-arm64', kind: 'gate', depends_on: ['artifact-publication'] },
      { id: 'published-amd64', kind: 'gate', depends_on: ['published-arm64'] },
      { id: 'release', kind: 'publication', depends_on: ['published-arm64', 'published-amd64'] },
      { id: 'issues', kind: 'publication', depends_on: ['release'] },
      { id: 'reflection', kind: 'publication', depends_on: ['issues'] },
    ], criteria, actions, hooks: { config_path: hooksSource.path, config_sha256: hooksSource.sha256 },
  };
  const contractDigest = sha256(canonicalJson(contract));
  const now = Math.floor(Date.now() / 1000);
  const evidence: Evidence = { schema_version: 1, contract_digest: contractDigest, records: criteria.map(item => ({
    id: `${item.id}-${contractDigest.slice(0, 16)}`, criterion_id: item.id, contract_digest: contractDigest,
    identity: contract.identity,
    artifact_path: item.id === 'local-runner-operation' && active !== null ? active.receipt.receiptSource.path : assertionSource.path,
    artifact_sha256: item.id === 'local-runner-operation' && active !== null ? active.receipt.receiptSource.sha256 : assertionSource.sha256,
    captured_at: now, expires_at: null, supersedes: null,
    origin: { runner: 'phase-exit-uar-readonly-importer-v1', config_sha256: snapshotSource.sha256,
      platform: `${process.platform}-${process.arch}`, artifact_identity: contract.identity },
    operation: item.id === 'local-runner-operation' && active !== null ? active.operation : null,
  })) };
  generated.set('contract.draft.json', `${JSON.stringify(contract, null, 2)}\n`);
  generated.set('evidence.json', `${JSON.stringify(evidence, null, 2)}\n`);
  // A changing original receipt during collection yields no coherent import. Do not stop its running process.
  for (const item of captured) if (sha256(await readFile(item.original)) !== item.source.sha256) throw new Error('INPUT_CHANGED_DURING_COLLECTION');
  if (await sourceIdentity(root, SOURCE_PATHS) !== sourceTree || await sourceIdentity(root, FIXTURE_PATHS) !== fixtureTree) throw new Error('SOURCE_CHANGED_DURING_COLLECTION');
  if (active !== null && active.operation.expires_at <= Math.floor(Date.now() / 1000)) throw new Error('ACTIVE_OPERATION_OBSERVATION_EXPIRED');
  await mkdir(output, { mode: 0o700 });
  await mkdir(join(output, 'sources'), { mode: 0o700 });
  for (const item of captured) await writeFile(item.source.path, item.bytes, { flag: 'wx', mode: 0o600 });
  for (const [name, data] of generated) await writeFile(join(output, name), data, { flag: 'wx', mode: 0o600 });
  return { contract: join(output, 'contract.draft.json'), evidence: join(output, 'evidence.json'),
    adoptionMap: join(output, 'adoption-map.json'), snapshot: snapshotSource.path, contractDigest,
    status: 'draft_requires_operator_adoption', implementationItems: items.length,
    imageScenarios: GROUPS.reduce((count, group) => count + IMAGE_SCENARIOS[group].length, 0), nativeSupplements: NATIVE_SUPPLEMENTS.length, warnings };
}
function objOrEmptyGroup(receipt: ImportedReceipt, group: string): ObjectValue {
  return optionalObject(optionalObject(receipt.receipt.groups)[group]);
}
function hasObservations(value: Json | undefined): boolean {
  return (Array.isArray(value) && value.length > 0)
    || (typeof value === 'object' && value !== null && Object.keys(value).length > 0);
}
