/** Bounded, serialized acceptance. Invoke only after the full implementation inventory. */
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { importUarSnapshot, GROUPS, NATIVE_SUPPLEMENTS, IMAGE_SCENARIOS } from "../packages/uar/index.js";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Obj = { [key: string]: Json };
interface Result { executable: string; argv: string[]; exit_code: number; stdout: string; stderr: string }
interface CaseReceipt { id: string; passed: boolean; detail: string }
interface Fixture {
  dir: string; state: string; contractPath: string; evidencePath: string;
  contract: Obj; evidence: Obj; digest: string;
}
interface AdoptedCalibration {
  set: Obj; source: string; fixtureDigest: string; adoptionDigest: string; mappingDigest: string;
  amendmentDigest: string; rubricVersion: string; question: string;
}
interface SemanticObservation {
  observation: Obj; criterion: string; calibration: AdoptedCalibration;
}
interface AdoptionAuthority { reviewer: string; reviewRationale: string; operator: string; rationale: string }
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(root, "..");
const binary = process.env.PHASE_EXIT_BINARY ?? join(project, "target", "debug", "phase-exit");
const output = resolve(process.env.PHASE_EXIT_ACCEPTANCE_OUTPUT ?? join(project, ".phase-exit", "private", `acceptance-${Date.now()}`));
const cases: CaseReceipt[] = [];
const commands: Obj[] = [];
const selectedCases = process.env.PHASE_EXIT_ACCEPTANCE_CASES?.split(",").filter(Boolean);
const calibrationProofPath = process.env.PHASE_EXIT_CALIBRATION_PROOF;
let successfulCalibration: AdoptedCalibration | undefined;
let retainedCalibrationProof: Obj | null = null;
process.env.PHASE_EXIT_HOOK_RUNNER = join(root, "packages", "hooks", "runner.js");
const now = (): number => Math.floor(Date.now() / 1000);
const hash = (bytes: string | Buffer): string => createHash("sha256").update(bytes).digest("hex");
function object(value: unknown): Obj {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object");
  return value as Obj;
}
function array(value: Json | undefined): Json[] {
  if (!Array.isArray(value)) throw new Error("Expected JSON array");
  return value;
}
function text(value: Json | undefined): string {
  if (typeof value !== "string") throw new Error("Expected string");
  return value;
}
function expect(value: boolean, detail: string): void { if (!value) throw new Error(detail); }
function canonical(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key] ?? null)}`).join(",")}}`;
  return JSON.stringify(value);
}
function sameJson(left: Json | undefined, right: Json | undefined): boolean {
  return left !== undefined && right !== undefined && canonical(left) === canonical(right);
}
async function adoptedCalibration(): Promise<AdoptedCalibration> {
  const mappingBytes = await readFile(join(project, ".phase-exit", "adoptions", "calibration-terminal-receipts-v2.mapping.json"));
  const mapping = object(JSON.parse(mappingBytes.toString("utf8")));
  expect(mapping["schema_version"] === 1 && mapping["kind"] === "adopted_calibration_mapping", "Calibration mapping is not the adopted version1 record");
  const adoptionPath = ".phase-exit/adoptions/calibration-terminal-receipts-v2.json";
  const amendmentPath = "docs/amendments/calibration-terminal-receipts-v2.json";
  const fixturePath = "fixtures/semantic-examples-v2.json";
  const originalPath = "fixtures/semantic-examples.json";
  expect(mapping["adoption_record"] === adoptionPath && mapping["amendment_path"] === amendmentPath && mapping["fixture_path"] === fixturePath && mapping["original_fixture_path"] === originalPath, "Calibration mapping references unexpected artifacts");
  async function bound(path: string, expected: Json | undefined): Promise<Buffer> {
    const bytes = await readFile(join(project, path));
    expect(typeof expected === "string" && /^[a-f0-9]{64}$/.test(expected) && hash(bytes) === expected, `Calibration identity mismatch: ${path}`);
    return bytes;
  }
  const adoptionBytes = await bound(adoptionPath, mapping["adoption_sha256"]);
  const adoption = object(JSON.parse(adoptionBytes.toString("utf8")));
  const amendmentBytes = await bound(amendmentPath, mapping["amendment_sha256"]);
  const amendment = object(JSON.parse(amendmentBytes.toString("utf8")));
  const fixtureBytes = await bound(fixturePath, mapping["fixture_sha256"]);
  const set = object(JSON.parse(fixtureBytes.toString("utf8")));
  const originalBytes = await bound(originalPath, mapping["original_fixture_sha256"]);
  const original = object(JSON.parse(originalBytes.toString("utf8")));
  expect(adoption["schema_version"] === 1 && adoption["kind"] === "calibration_amendment_adoption" && adoption["amendment_id"] === "calibration-terminal-receipts-v2" && text(adoption["authorization"]).length > 0 && text(adoption["operator"]).length > 0, "Explicit calibration adoption record missing");
  expect(adoption["amendment_path"] === amendmentPath && adoption["amendment_sha256"] === hash(amendmentBytes), "Adoption does not bind the reviewed amendment");
  const reviewPath = "docs/amendments/calibration-terminal-receipts-v2.review-2.json";
  expect(adoption["review_path"] === reviewPath, "Adoption references an unexpected review");
  const review = object(JSON.parse((await bound(reviewPath, adoption["review_sha256"])).toString("utf8")));
  expect(review["schema_version"] === 1 && review["amendment_id"] === adoption["amendment_id"] && review["verdict"] === "PROPOSAL_READY_FOR_OPERATOR_REVIEW" && array(review["findings"]).length === 0, "Reviewed calibration amendment has unresolved findings");
  expect(amendment["schema_version"] === 1 && amendment["id"] === adoption["amendment_id"] && set["schema_version"] === 1 && set["id"] === adoption["amendment_id"], "Calibration amendment/fixture identity differs");
  for (const record of [adoption, amendment, set]) expect(record["parent_examples_sha256"] === hash(originalBytes), "Original frozen examples identity differs");
  expect(set["adoption_record"] === adoptionPath && set["adoption_sha256"] === hash(adoptionBytes) && set["amendment_path"] === amendmentPath && set["amendment_sha256"] === hash(amendmentBytes), "Frozen fixture does not bind adopted authority");
  for (const policy of [adoption, object(amendment["unchanged"]), object(mapping["unchanged"])]) {
    expect(policy["model"] === "jev-1.14.0" && policy["channel"] === "preview" && policy["support_threshold"] === 0.95 && policy["contradiction_threshold"] === 0.05, "Adopted model/channel/thresholds changed");
  }
  for (const policy of [original, set]) expect(policy["model"] === "jev-1.14.0" && policy["model_channel"] === "preview" && policy["support_threshold"] === 0.95 && policy["contradiction_threshold"] === 0.05, "Frozen model/channel/thresholds changed");
  expect(sameJson(mapping["unchanged"], amendment["unchanged"]), "Mapping changed the adopted unchanged policy");
  const rubric = object(amendment["proposed_rubric"]);
  expect(set["rubric_version"] === "terminal-receipts-v2" && set["rubric_version"] === rubric["version"] && set["rubric_question"] === rubric["question"], "Frozen rubric differs from reviewed amendment");
  expect(sameJson(set["examples"], amendment["examples"]) && sameJson(set["calibration_acceptance"], amendment["calibration_acceptance"]), "Frozen examples or classification rules differ from reviewed amendment");
  expect(sameJson(mapping["affected_gates"], ["jev-live-frozen-calibration", "real-uar-import"]), "Mapping changed the affected gate set");
  const examples = array(set["examples"]).map(object);
  expect(examples.length === 3 && ["supported", "contradicted", "uncertain"].every(id => examples.filter(example => example["id"] === id && example["expected_semantic_outcome"] === id).length === 1), "Calibration requires exactly the three adopted semantic classes");
  return { set, source: fixtureBytes.toString("utf8"), fixtureDigest: hash(fixtureBytes), adoptionDigest: hash(adoptionBytes), mappingDigest: hash(mappingBytes), amendmentDigest: hash(amendmentBytes), rubricVersion: text(set["rubric_version"]), question: text(set["rubric_question"]) };
}
async function retainedCalibration(path: string): Promise<AdoptedCalibration> {
  expect(isAbsolute(path), "Retained calibration proof path must be absolute");
  const proofBytes = await readFile(path);
  const proof = object(JSON.parse(proofBytes.toString("utf8")));
  expect(proof["schema_version"] === 1 && proof["kind"] === "retained_calibration_pass", "Expected explicit retained calibration proof");
  async function bound(pathValue: Json | undefined, digest: Json | undefined): Promise<Obj> {
    const artifactPath = text(pathValue);
    expect(isAbsolute(artifactPath), "Retained calibration artifact paths must be absolute");
    const bytes = await readFile(artifactPath);
    expect(typeof digest === "string" && /^[a-f0-9]{64}$/.test(digest) && hash(bytes) === digest, `Retained calibration artifact identity mismatch: ${artifactPath}`);
    return object(JSON.parse(bytes.toString("utf8")));
  }
  const program = await bound(proof["program_receipt"], proof["program_receipt_sha256"]);
  const observations = await bound(proof["observations"], proof["observations_sha256"]);
  expect(output !== dirname(text(proof["program_receipt"])) && output !== dirname(text(proof["observations"])), "Retained calibration requires a new output directory; original receipts must remain unchanged");
  const binaryDigest = hash(await readFile(binary));
  expect(proof["binary_sha256"] === binaryDigest && program["binary_sha256"] === binaryDigest, "Retained calibration belongs to a different Rust binary");
  expect(program["schema_version"] === 1 && (program["status"] === "passed" || program["status"] === "failed"), "Retained calibration program receipt is not terminal");
  const priorCases = array(program["cases"]).map(object);
  const calibrationCases = priorCases.filter(item => item["id"] === "jev-live-frozen-calibration");
  expect(calibrationCases.length === 1 && calibrationCases[0]?.["passed"] === true && priorCases.every(item => typeof item["passed"] === "boolean"), "Original program did not record a passing calibration case");
  const failedCases = priorCases.filter(item => item["passed"] === false);
  expect(program["status"] === "passed" ? failedCases.length === 0 : failedCases.length === 1 && failedCases[0]?.["id"] === "real-uar-import", "Original program failed outside the bounded UAR import gate");
  const calibration = await adoptedCalibration();
  const identities: Obj = { fixture_sha256: calibration.fixtureDigest, adoption_sha256: calibration.adoptionDigest, mapping_sha256: calibration.mappingDigest, amendment_sha256: calibration.amendmentDigest };
  for (const [key, digest] of Object.entries(identities)) expect(proof[key] === digest && observations[key] === digest, `Retained calibration changed adopted identity: ${key}`);
  expect(observations["schema_version"] === 1 && observations["rubric_version"] === calibration.rubricVersion && array(observations["failures"]).length === 0, "Retained observations do not record a successful adopted calibration");
  const observed = array(observations["observations"]).map(object);
  const judgments = array(proof["cache_judgments"]).map(object);
  expect(observed.length === 3 && judgments.length === 3, "Retained calibration requires exactly three original live judgments");
  for (const example of array(calibration.set["examples"]).map(object)) {
    const id = text(example["id"]);
    const matching = observed.filter(item => item["id"] === id);
    const cached = judgments.filter(item => item["id"] === id);
    expect(matching.length === 1 && cached.length === 1, `Retained calibration class missing or duplicated: ${id}`);
    const observation = object(matching[0]);
    const cache = object(cached[0]);
    const judgment = await bound(cache["path"], cache["sha256"]);
    const response = object(judgment["response"]);
    const answers = object(response["answers"]);
    const supportAnswer = object(answers["support"]); const contradictionAnswer = object(answers["contradiction"]);
    const support = observation["support"]; const contradiction = observation["contradiction"];
    expect(typeof support === "number" && Number.isFinite(support) && support >= 0 && support <= 1 && typeof contradiction === "number" && Number.isFinite(contradiction) && contradiction >= 0 && contradiction <= 1, "Retained calibration probabilities are invalid");
    expect(judgment["live"] === true && judgment["model"] === "jev-1.14.0" && response["model"] === "jev-1.14.0" && /^[a-f0-9]{64}$/.test(text(observation["request_digest"])) && judgment["request_digest"] === observation["request_digest"], "Retained judgment model, live provenance or request identity differs");
    expect(Object.keys(answers).length === 2 && supportAnswer["type"] === "noul" && contradictionAnswer["type"] === "noul" && judgment["support"] === support && supportAnswer["noul"] === support && judgment["contradiction"] === contradiction && contradictionAnswer["noul"] === contradiction, "Retained judgment response differs from recorded probabilities");
    expect(observation["expected"] === example["expected_semantic_outcome"] && observation["decision"] === (id === "supported" ? "COMPLETE" : "REVIEW_REQUIRED"), "Retained semantic class decision differs from adopted example");
    if (id === "supported") expect(typeof support === "number" && support >= 0.95 && typeof contradiction === "number" && contradiction <= 0.05, "Retained supported class did not pass");
    else if (id === "contradicted") expect(typeof contradiction === "number" && contradiction >= 0.95, "Retained contradicted class did not pass");
    else expect(typeof support === "number" && typeof contradiction === "number" && contradiction < 0.95 && !(support >= 0.95 && contradiction <= 0.05), "Retained uncertain class did not pass");
  }
  retainedCalibrationProof = { path, sha256: hash(proofBytes), program_receipt: proof["program_receipt"] ?? null, program_receipt_sha256: proof["program_receipt_sha256"] ?? null, observations_sha256: proof["observations_sha256"] ?? null };
  return calibration;
}
async function jsonFile(path: string, value: Json): Promise<string> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}
async function run(executable: string, argv: string[], env: NodeJS.ProcessEnv = process.env, input?: string): Promise<Result> {
  const result = await new Promise<Result>((fulfill, reject) => {
    const child = spawn(executable, argv, { cwd: project, env, shell: false, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = ""; let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => { stdout += chunk; });
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => fulfill({ executable, argv, exit_code: code ?? -1, stdout, stderr }));
    child.stdin.end(input);
  });
  const secret = process.env.JEV_API_KEY;
  if (secret && (result.stdout.includes(secret) || result.stderr.includes(secret))) {
    throw new Error("Credential exposure detected; raw child output withheld");
  }
  const prefix = join(output, "commands", String(commands.length + 1).padStart(5, "0"));
  await mkdir(dirname(prefix), { recursive: true });
  await writeFile(`${prefix}.stdout`, result.stdout);
  await writeFile(`${prefix}.stderr`, result.stderr);
  commands.push({ executable, argv, exit_code: result.exit_code, stdout_path: `${prefix}.stdout`, stderr_path: `${prefix}.stderr`, stdout_sha256: hash(result.stdout), stderr_sha256: hash(result.stderr) });
  return result;
}
async function cli(argv: string[], accepted = [0], env?: NodeJS.ProcessEnv): Promise<Obj> {
  const result = await run(binary, argv, env);
  expect(accepted.includes(result.exit_code), `CLI exit ${result.exit_code}; expected ${accepted.join(",")}; ${result.stderr.slice(0, 500)}`);
  return object(JSON.parse(result.stdout));
}
async function one(id: string, work: () => Promise<void>): Promise<void> {
  if (selectedCases && !selectedCases.includes(id)) return;
  try { await work(); cases.push({ id, passed: true, detail: "Observed expected production-path outcome" }); }
  catch (error) { cases.push({ id, passed: false, detail: error instanceof Error ? error.message : "Unknown failure" }); }
  await jsonFile(join(output, "receipt.json"), { schema_version: 1, status: "running", cases: cases.map(c => ({ ...c })), commands, retained_calibration_proof: retainedCalibrationProof });
  process.stdout.write(`${id}: ${cases.at(-1)?.passed ? "PASS" : "FAIL"}\n`);
}
async function adopt(f: Fixture, previous: string | null = null, invalidated: string[] = [], authority: AdoptionAuthority = { reviewer: "bounded-acceptance-fixture", reviewRationale: "Operator approved isolated acceptance fixtures; not UAR adoption", operator: "approved-fixture-program", rationale: "Exercise explicitly approved isolated fixture authority" }): Promise<void> {
  await jsonFile(f.contractPath, f.contract);
  const imported = await cli(["contract", "import", "--contract", f.contractPath, "--state-dir", f.state]);
  f.digest = text(imported["contract_digest"]);
  const reviewed = await cli(["contract", "freeze", "--contract", f.contractPath, "--reviewer", authority.reviewer, "--rationale", authority.reviewRationale, "--state-dir", f.state]);
  const adoption = await jsonFile(join(f.dir, `adoption-${String(f.contract["revision"])}.json`), {
    schema_version: 1, contract_digest: f.digest, review_digest: reviewed["review_digest"] ?? null,
    previous_contract_digest: previous, operator: authority.operator, rationale: authority.rationale, invalidated_criteria: invalidated,
  });
  await cli(["contract", "adopt", "--contract", f.contractPath, "--adoption", adoption, "--state-dir", f.state]);
}
async function fixture(name: string, options: { publication?: boolean; external?: boolean; semantic?: string; semanticObservation?: SemanticObservation; hooks?: Obj; failedCommand?: boolean; repair?: boolean; secondGate?: boolean } = {}): Promise<Fixture> {
  const dir = join(output, name); await mkdir(dir, { recursive: true });
  const source = join(dir, "approved-plan.md"); await writeFile(source, options.semanticObservation?.calibration.source ?? "Frozen bounded acceptance example approved in the Phase Exit plan.\n");
  const sourceHash = hash(await readFile(source));
  const implementation = join(dir, "implementation.json"); await jsonFile(implementation, { complete: true });
  const criteria: Json[] = [{ id: "implementation", stage: "implement", description: "Complete fixture implementation artifact", expected_outcome: "All approved implementation exists", source_id: "plan", depends_on: [], predicate: { kind: "file_sha256", sha256: hash(await readFile(implementation)) } }];
  const actions: Json[] = [{ id: "accept-command", stage: "accept", kind: "gate", executable: process.execPath, argv: [join(root, "tests", "fixture-command.js"), options.failedCommand ? "failure" : "success"], cwd: project, repairs_criteria: [], covers_criteria: ["acceptance"] }];
  let predicate: Obj = { kind: "command_success", action_id: "accept-command" };
  if (options.external) predicate = { kind: "external_ready", pointer: "/available" };
  if (options.semantic) predicate = { kind: "semantic", pointer: "/statement", question: "Does the supplied original receipt establish that the command finished successfully with exit code zero?" };
  if (options.semanticObservation) predicate = { kind: "semantic", pointer: "/observation", question: options.semanticObservation.calibration.question };
  criteria.push({ id: "acceptance", stage: "accept", description: options.semanticObservation?.criterion ?? "The recorded command finished successfully with exit code zero.", expected_outcome: options.semanticObservation?.criterion ?? "A terminal success with exit code zero is observed", source_id: "plan", depends_on: ["implementation"], predicate });
  const stages: Json[] = [{ id: "implement", kind: "implementation", depends_on: [] }, { id: "accept", kind: "gate", depends_on: ["implement"] }];
  if (options.publication) {
    stages.push({ id: "publish", kind: "publication", depends_on: ["accept"] });
    criteria.push({ id: "publication", stage: "publish", description: "Release receipt exists", expected_outcome: "Published artifact has a terminal receipt", source_id: "plan", depends_on: ["acceptance"], predicate: { kind: "json_equals", pointer: "/published", expected: true } });
    actions.push({ id: "publish-command", stage: "publish", kind: "publication", executable: process.execPath, argv: [join(root, "tests", "fixture-command.js"), "success"], cwd: project, repairs_criteria: [], covers_criteria: ["publication"] });
  }
  if (options.repair) actions.push({ id: "repair-acceptance", kind: "repair", stage: "accept", executable: process.execPath, argv: [join(root, "tests", "fixture-command.js"), "success"], cwd: project, repairs_criteria: ["acceptance"], covers_criteria: [] });
  if (options.secondGate) {
    actions.push({ id: "accept-command-b", kind: "gate", stage: "accept", executable: process.execPath, argv: [join(root, "tests", "fixture-command.js"), "success", "second-gate"], cwd: project, repairs_criteria: [], covers_criteria: ["acceptance-b"] });
    criteria.push({ id: "acceptance-b", stage: "accept", description: "Second approved gate has its own terminal observation", expected_outcome: "The second exact action completed successfully", source_id: "plan", depends_on: ["implementation"], predicate: { kind: "command_success", action_id: "accept-command-b" } });
  }
  const contract: Obj = {
    schema_version: 1, id: name, project: "phase-exit", phase: "bounded-acceptance", revision: 1, parent_digest: null,
    identity: { source: sourceHash, fixture: options.semanticObservation?.calibration.rubricVersion ?? "bounded-v1", platform: `${process.platform}-${process.arch}`, ...(options.semanticObservation ? { calibration_fixture: options.semanticObservation.calibration.fixtureDigest, calibration_adoption: options.semanticObservation.calibration.adoptionDigest } : {}) },
    exclusions: ["Windows qualification", "Unrelated product tests"], prerequisites: options.external ? ["acceptance"] : [],
    boundary: { implementation_stages: ["implement"] }, retry_limits: { max_attempts: 3, max_elapsed_seconds: 60 },
    jev: { model: "jev-1.14.0", rubric_version: options.semanticObservation?.calibration.rubricVersion ?? "bounded-v1", support_threshold: 0.95, contradiction_threshold: 0.05 },
    sources: ["assessment", "analysis", "specification", "plan"].map(role => ({ id: role, role, path: source, sha256: sourceHash })), conflicts: [], stages, criteria, actions, hooks: options.hooks ?? null,
  };
  const f: Fixture = { dir, state: join(dir, "state"), contractPath: join(dir, "contract.json"), evidencePath: join(dir, "evidence.json"), contract, evidence: {}, digest: "" };
  await adopt(f);
  f.evidence = { schema_version: 1, contract_digest: f.digest, records: [await receipt(f, "implementation", implementation)] };
  if (options.external) {
    const artifact = await jsonFile(join(dir, "external.json"), { available: false, reason: "Required genuine collaborator is unavailable" });
    array(f.evidence["records"]).push(await receipt(f, "acceptance", artifact));
  } else if (options.semanticObservation) {
    const artifact = await jsonFile(join(dir, "semantic.json"), { observation: options.semanticObservation.observation });
    array(f.evidence["records"]).push(await receipt(f, "acceptance", artifact));
  } else if (options.semantic) {
    const artifact = await jsonFile(join(dir, "semantic.json"), { statement: options.semantic });
    array(f.evidence["records"]).push(await receipt(f, "acceptance", artifact));
  } else {
    array(f.evidence["records"]).push(await commandReceipt(f));
  }
  await jsonFile(f.evidencePath, f.evidence);
  return f;
}
async function receipt(f: Fixture, criterion: string, artifact: string): Promise<Obj> {
  return { id: `${criterion}-${randomUUID()}`, criterion_id: criterion, contract_digest: f.digest, identity: f.contract["identity"] ?? {}, artifact_path: artifact, artifact_sha256: hash(await readFile(artifact)), captured_at: now(), expires_at: null, supersedes: null, origin: { runner: "phase-exit-bounded-acceptance", config_sha256: hash("bounded-v1"), platform: `${process.platform}-${process.arch}`, artifact_identity: f.contract["identity"] ?? {} }, operation: null };
}
async function commandReceipt(f: Fixture): Promise<Obj> {
  const action = object(array(f.contract["actions"])[0]);
  const result = await run(text(action["executable"]), array(action["argv"]).map(v => text(v)));
  const stdout = join(f.dir, `stdout-${randomUUID()}`); const stderr = join(f.dir, `stderr-${randomUUID()}`);
  await writeFile(stdout, result.stdout); await writeFile(stderr, result.stderr);
  const artifact = await jsonFile(join(f.dir, `command-${randomUUID()}.json`), { action_id: "accept-command", executable: result.executable, argv: result.argv, cwd: project, exit_code: result.exit_code, stdout_sha256: hash(result.stdout), stderr_sha256: hash(result.stderr), stdout_path: stdout, stderr_path: stderr });
  return receipt(f, "acceptance", artifact);
}
async function evaluate(f: Fixture, stage = "accept", extra: string[] = [], env?: NodeJS.ProcessEnv): Promise<Obj> {
  await jsonFile(f.evidencePath, f.evidence);
  return cli(["evaluate", "--contract", f.contractPath, "--evidence", f.evidencePath, "--stage", stage, "--state-dir", f.state, ...extra], [0, 10, 11, 12, 13, 14], env);
}
async function assertCalibrationFixture(f: Fixture, example: Obj, calibration: AdoptedCalibration): Promise<void> {
  expect(sameJson(f.contract["jev"], { model: "jev-1.14.0", rubric_version: calibration.rubricVersion, support_threshold: 0.95, contradiction_threshold: 0.05 }), "Resumed calibration changed model, rubric or thresholds");
  const identity = object(f.contract["identity"]);
  expect(identity["fixture"] === calibration.rubricVersion && identity["calibration_fixture"] === calibration.fixtureDigest && identity["calibration_adoption"] === calibration.adoptionDigest && identity["source"] === calibration.fixtureDigest, "Calibration state belongs to another fixture/adoption");
  const criterion = array(f.contract["criteria"]).map(object).find(item => item["id"] === "acceptance");
  expect(criterion !== undefined && criterion["description"] === example["criterion"] && criterion["expected_outcome"] === example["criterion"] && sameJson(criterion["predicate"], { kind: "semantic", pointer: "/observation", question: calibration.question }), "Calibration criterion or question differs from adopted mapping");
  const sources = array(f.contract["sources"]).map(object);
  expect(sources.length > 0, "Calibration source snapshot missing");
  for (const source of sources) expect(source["sha256"] === calibration.fixtureDigest && hash(await readFile(text(source["path"]))) === calibration.fixtureDigest, "Calibration source snapshot differs from frozen fixture");
  const records = array(f.evidence["records"]).map(object);
  const superseded = new Set(records.map(record => record["supersedes"]));
  const current = records.filter(record => record["criterion_id"] === "acceptance" && !superseded.has(record["id"]));
  expect(current.length === 1, "Calibration requires one current structured observation");
  const observation = object(JSON.parse(await readFile(text(object(current[0])["artifact_path"]), "utf8")));
  expect(sameJson(observation, { observation: object(example["evidence"]) }), "Calibration evidence differs from the adopted structured observation");
}
const verdict = (d: Obj, expected: string): void => expect(d["verdict"] === expected, `Expected ${expected}, observed ${String(d["verdict"])}: ${JSON.stringify(d["reasons"])}`);

if (calibrationProofPath) {
  expect(selectedCases?.length === 1 && selectedCases[0] === "real-uar-import", "Retained calibration proof permits only the real-uar-import rerun");
  successfulCalibration = await retainedCalibration(calibrationProofPath);
} else if (selectedCases?.some(id => id === "jev-live-frozen-calibration" || id === "real-uar-import")) {
  expect(selectedCases.length === 2 && selectedCases.includes("jev-live-frozen-calibration") && selectedCases.includes("real-uar-import"), "Adopted calibration rerun must select exactly jev-live-frozen-calibration,real-uar-import together");
}
await mkdir(output, { recursive: true });
await one("pinned-toolchain", async () => {
  expect(process.version === "v24.22.0", `Expected Node24.22.0, observed ${process.version}`);
  const compiler = object(JSON.parse(await readFile(join(project, "node_modules", "typescript", "package.json"), "utf8")));
  expect(compiler["version"] === "7.0.2", "TypeScript package differs from pinned7.0.2");
});
await one("complete-real-command", async () => {
  const d = await evaluate(await fixture("complete")); verdict(d, "COMPLETE"); expect(d["stage_complete"] === true && d["phase_complete"] === true, "Completion fields differ");
});
await one("stage-not-phase", async () => {
  const d = await evaluate(await fixture("stage", { publication: true })); verdict(d, "COMPLETE"); expect(d["stage_complete"] === true && d["phase_complete"] === false, "Stage success leaked into phase success");
});
await one("failed-observation-bounded-repair", async () => {
  const f = await fixture("failed", { failedCommand: true, repair: true });
  const d = await evaluate(f); verdict(d, "CONTINUE"); expect(object(d["next_authorized_action"])["id"] === "repair-acceptance", "Failed observation did not select exact repair");
});
await one("missing-and-stale-approved-collection", async () => {
  const f = await fixture("missing"); array(f.evidence["records"]).splice(1);
  verdict(await evaluate(f), "CONTINUE");
  const stale = await commandReceipt(f); stale["captured_at"] = now() - 10; stale["expires_at"] = now() - 1;
  array(f.evidence["records"]).push(stale); verdict(await evaluate(f), "CONTINUE");
});
await one("tampered-evidence", async () => {
  const f = await fixture("tampered"); const rec = object(array(f.evidence["records"])[1]);
  await writeFile(text(rec["artifact_path"]), "tampered"); verdict(await evaluate(f), "INVALID");
});
await one("active-operation-no-duplicate", async () => {
  const f = await fixture("active"); const rec = object(array(f.evidence["records"])[1]);
  rec["operation"] = { id: "running-operation", action_id: "accept-command", state: "running", started_at: now() - 1, expires_at: now() + 300 };
  const d = await evaluate(f); verdict(d, "WAIT"); expect(d["next_authorized_action"] === null, "Running operation authorized a duplicate");
});
await one("external-blocker", async () => verdict(await evaluate(await fixture("external", { external: true })), "BLOCKED"));
await one("closed-implementation-boundary", async () => {
  const f = await fixture("closed"); array(f.evidence["records"]).splice(0, 1);
  const d = await evaluate(f); expect(d["next_authorized_action"] === null, "Gate became authorized before implementation proof");
  expect(d["stage_complete"] === false && d["phase_complete"] === false, "Missing implementation certified stage");
});
await one("exact-action-and-scope-expansion", async () => {
  const f = await fixture("authority"); array(f.evidence["records"]).splice(1); await jsonFile(f.evidencePath, f.evidence);
  const action = object(array(f.contract["actions"])[0]);
  const request: Obj = { schema_version: 1, action_id: action["id"] ?? null, kind: action["kind"] ?? null, executable: action["executable"] ?? null, argv: action["argv"] ?? [], cwd: action["cwd"] ?? null };
  const path = await jsonFile(join(f.dir, "request.json"), request);
  const args = ["action", "authorize", "--contract", f.contractPath, "--evidence", f.evidencePath, "--request", path, "--state-dir", f.state];
  expect((await cli(args))["authorized"] === true, "Exact approved gate denied");
  array(request["argv"]).push("unapproved-scope"); await jsonFile(path, request);
  expect((await cli(args, [12, 14]))["authorized"] === false, "Scope expansion authorized");
});
await one("select-pending-gate-within-stage", async () => {
  const f = await fixture("two-gates", { secondGate: true });
  const d = await evaluate(f); verdict(d, "CONTINUE");
  expect(object(d["next_authorized_action"])["id"] === "accept-command-b", "Passing gateA starved missing gateB");
  const action = object(array(f.contract["actions"])[1]);
  const path = await jsonFile(join(f.dir, "request-b.json"), { schema_version: 1, action_id: action["id"] ?? null, kind: action["kind"] ?? null, executable: action["executable"] ?? null, argv: action["argv"] ?? [], cwd: action["cwd"] ?? null });
  const authorized = await cli(["action", "authorize", "--contract", f.contractPath, "--evidence", f.evidencePath, "--request", path, "--state-dir", f.state]);
  expect(authorized["authorized"] === true, "Pending gateB remained unauthorized");
});
await one("retry-exhaustion", async () => {
  const f = await fixture("attempts", { failedCommand: true, repair: true });
  let prior = object(array(f.evidence["records"])[1]);
  await evaluate(f);
  for (let index = 0; index < 2; index += 1) {
    const rec = await commandReceipt(f); rec["supersedes"] = prior["id"] ?? null;
    array(f.evidence["records"]).push(rec); prior = rec;
  }
  verdict(await evaluate(f), "REVIEW_REQUIRED");
});
await one("amendment-proposal-and-adoption", async () => {
  const f = await fixture("amendment"); await evaluate(f);
  const previous = f.digest; const previousPath = join(f.dir, "previous-contract.json"); await jsonFile(previousPath, f.contract);
  f.contract = object(JSON.parse(JSON.stringify(f.contract))); f.contract["revision"] = 2; f.contract["parent_digest"] = previous;
  object(array(f.contract["criteria"])[1])["expected_outcome"] = "Explicitly amended expected outcome with retained runtime proof requirements";
  await jsonFile(f.contractPath, f.contract);
  const proposal = await cli(["contract", "propose-revision", "--contract", previousPath, "--other", f.contractPath, "--state-dir", f.state]);
  expect(array(proposal["invalidated_criteria"]).includes("acceptance"), "Amendment failed to invalidate changed criterion");
  verdict(await evaluate(f), "INVALID");
  await adopt(f, previous, array(proposal["invalidated_criteria"]).map(v => text(v)));
  verdict(await evaluate(f), "INVALID");
  expect((await readdir(join(f.state, "adoptions"))).length === 2, "Prior adoption was not preserved");
});
await one("append-only-learning-does-not-expand-scope", async () => {
  const f = await fixture("learning"); await evaluate(f);
  const learning: Obj = { schema_version: 1, id: "observed-learning", contract_digest: f.digest, kind: "discovery", summary: "The bounded command observation establishes only this criterion", evidence_refs: [object(array(f.evidence["records"])[1])["id"] ?? null], proposed_criteria: [], supersedes: null, classification: "clarification", disposition: "Retain existing scope and source reference", affected_criteria: ["acceptance"] };
  const path = await jsonFile(join(f.dir, "learning.json"), learning);
  const args = ["learn", "record", "--learning", path, "--state-dir", f.state];
  expect((await cli(args))["scope_changed"] === false, "Learning changed authoritative scope");
  learning["summary"] = "Attempt to rewrite prior learning"; await jsonFile(path, learning);
  await cli(args, [14]);
  verdict(await evaluate(f), "COMPLETE");
});

for (const mode of ["pass", "veto", "fail", "credential"] as const) {
  await one(`hook-${mode}`, async () => {
    const dir = join(output, `hook-config-${mode}`); await mkdir(dir, { recursive: true });
    const module = join(root, "fixtures", "hooks", `${mode}.js`);
    const config = await jsonFile(join(dir, "hooks.json"), { schema_version: 1, hooks: [{ id: mode, event: "evaluation.before", module, sha256: hash(await readFile(module)), timeout_ms: 5000, required: true, env_allowlist: [], input_schema: "phase-exit/hook-input/v1", output_schema: "phase-exit/hook-output/v1" }] });
    const env = { ...process.env, PHASE_EXIT_HOOK_RUNNER: join(root, "packages", "hooks", "runner.js") };
    const f = await fixture(`hook-${mode}`, { hooks: { config_path: config, config_sha256: hash(await readFile(config)) } });
    const d = await evaluate(f, "accept", [], env);
    if (mode === "veto" || mode === "fail") expect(d["phase_complete"] === false && d["verdict"] !== "COMPLETE", "Hook failure/veto certified completion");
    else verdict(d, "COMPLETE");
  });
}
await one("hook-recursion", async () => {
  const f = await fixture("recursive");
  const d = await evaluate(f, "accept", [], { ...process.env, PHASE_EXIT_HOOK_ACTIVE: "1" });
  expect(d["verdict"] !== "COMPLETE" && d["phase_complete"] !== true, "Recursive engine invocation certified completion");
});
await one("optional-hook-failure", async () => {
  const dir = join(output, "optional-config"); await mkdir(dir, { recursive: true });
  const module = join(root, "fixtures", "hooks", "fail.js");
  const config = await jsonFile(join(dir, "hooks.json"), { schema_version: 1, hooks: [{ id: "optional", event: "evaluation.before", module, sha256: hash(await readFile(module)), timeout_ms: 5000, required: false, env_allowlist: [], input_schema: "phase-exit/hook-input/v1", output_schema: "phase-exit/hook-output/v1" }] });
  verdict(await evaluate(await fixture("optional", { hooks: { config_path: config, config_sha256: hash(await readFile(config)) } })), "COMPLETE");
});
for (const variant of ["uncertain", "contradicted", "malformed", "model-mismatch"] as const) {
  await one(`jev-controlled-${variant}`, async () => {
    const f = await fixture(`jev-${variant}`, { semantic: "A controlled response fixture exercises transport decoding, not live proof." });
    const body: Obj = { model: variant === "model-mismatch" ? "jev-latest" : "jev-1.14.0", answers: { support: { type: "noul", noul: variant === "malformed" ? "not-a-number" : variant === "contradicted" ? 0.01 : 0.5 }, contradiction: { type: "noul", noul: variant === "contradicted" ? 0.99 : 0.5 } }, usage: { input_tokens: 10, output_tokens: 4 } };
    const transport = await jsonFile(join(f.dir, "transport.json"), { schema_version: 1, status: 200, body });
    const d = await evaluate(f, "accept", ["--jev-fixture", transport]);
    expect(d["verdict"] !== "COMPLETE" && d["phase_complete"] !== true, "Controlled semantic response certified live completion");
    if (variant === "uncertain") verdict(d, "REVIEW_REQUIRED");
  });
}
await one("jev-transient-retry-exhaustion", async () => {
  const f = await fixture("jev-retry", { semantic: "Controlled transient transport failure" });
  const transport = await jsonFile(join(f.dir, "transport.json"), { schema_version: 1, attempts: [
    { status: 429, body: {}, retry_after_seconds: 0 },
    { status: 529, body: {}, retry_after_seconds: 0 },
    { status: 429, body: {}, retry_after_seconds: 0 },
  ] });
  verdict(await evaluate(f, "accept", ["--jev-fixture", transport]), "REVIEW_REQUIRED");
  const attempts = await readdir(join(f.state, "jev-attempts"));
  expect(attempts.length === 3, `Expected three bounded attempts, observed ${attempts.length}`);
  await evaluate(f, "accept", ["--jev-fixture", transport]);
  expect((await readdir(join(f.state, "jev-attempts"))).length === attempts.length, "Exhausted fingerprint restarted transient retries");
});
await one("jev-live-frozen-calibration", async () => {
  expect(Boolean(process.env.JEV_API_KEY), "Live JEV credential unavailable; live semantic claims unverified");
  const calibration = await adoptedCalibration();
  const set = calibration.set;
  const observations: Obj[] = [];
  const failures: string[] = [];
  for (const item of array(set["examples"])) {
    const example = object(item); const id = text(example["id"]);
    try {
    const resumeRoot = process.env.PHASE_EXIT_CALIBRATION_RESUME_ROOT;
    let f: Fixture;
    const fixtureName = `jev-live-${calibration.rubricVersion}-${id}`;
    const resumed = resumeRoot ? join(resumeRoot, fixtureName) : null;
    const exists = resumed ? await lstat(resumed).then(() => true, error => { if (object(error)["code"] === "ENOENT") return false; throw error; }) : false;
    if (resumed && exists) {
      const contractPath = join(resumed, "contract.json"); const evidencePath = join(resumed, "evidence.json");
      f = { dir: resumed, state: join(resumed, "state"), contractPath, evidencePath, contract: object(JSON.parse(await readFile(contractPath, "utf8"))), evidence: object(JSON.parse(await readFile(evidencePath, "utf8"))), digest: "" };
    } else {
      f = await fixture(fixtureName, { semanticObservation: { observation: object(example["evidence"]), criterion: text(example["criterion"]), calibration } });
    }
    await assertCalibrationFixture(f, example, calibration);
    const d = await evaluate(f);
    const outcome = text(example["expected_semantic_outcome"]);
    const cache = await readdir(join(f.state, "jev-cache"));
    expect(cache.length === 1, "Calibration requires one retained validated live judgment");
    const judgment = object(JSON.parse(await readFile(join(f.state, "jev-cache", cache[0] ?? "missing"), "utf8")));
    expect(judgment["live"] === true && judgment["model"] === "jev-1.14.0", "Calibration lacks exact preview-model live observation");
    const support = judgment["support"]; const contradiction = judgment["contradiction"];
    expect(typeof support === "number" && Number.isFinite(support) && support >= 0 && support <= 1 && typeof contradiction === "number" && Number.isFinite(contradiction) && contradiction >= 0 && contradiction <= 1, "Calibration probabilities missing or invalid");
    const codes = array(d["reasons"]).map(reason => object(reason)["code"]);
    const expectedCode = outcome === "contradicted" ? "SEMANTIC_CONTRADICTION" : "SEMANTIC_UNCERTAIN";
    expect(outcome === "supported" ? codes.length === 0 : codes.length === 1 && codes[0] === expectedCode, "Service, integrity or unrelated criterion failure is not a semantic calibration result");
    observations.push({ id, expected: outcome, decision: d["verdict"] ?? null, support: support ?? null, contradiction: contradiction ?? null, request_digest: judgment["request_digest"] ?? null, resumed: exists });
    const before = await readdir(join(f.state, "jev-attempts"));
    const sameSemanticDecision = (actual: Obj): void => {
      expect(actual["verdict"] === d["verdict"] && actual["verdict"] !== "INVALID" && JSON.stringify(actual["reasons"]) === JSON.stringify(d["reasons"]), "Repeated evaluation changed the semantic decision or invalidated evidence");
    };
    sameSemanticDecision(await evaluate(f));
    expect((await readdir(join(f.state, "jev-attempts"))).length === before.length, "Identical semantic evidence was resampled");
    const records = array(f.evidence["records"]).map(object);
    const superseded = new Set(records.map(record => record["supersedes"]));
    const current = records.filter(record => record["criterion_id"] === "acceptance" && !superseded.has(record["id"]));
    expect(current.length === 1, "Calibration requires one current acceptance receipt");
    const previous = object(current[0]);
    const refreshed = { ...previous, id: `refreshed-${randomUUID()}`, captured_at: now(), supersedes: previous["id"] ?? null };
    array(f.evidence["records"]).push(refreshed); sameSemanticDecision(await evaluate(f));
    expect((await readdir(join(f.state, "jev-attempts"))).length === before.length, "Receipt metadata refresh resampled unchanged semantic input");
    if (outcome === "supported") {
      verdict(d, "COMPLETE"); expect(typeof support === "number" && support >= 0.95 && typeof contradiction === "number" && contradiction <= 0.05, "Supported calibration threshold not observed");
      expect(d["phase_complete"] === true, "Supported calibration did not complete its isolated phase");
    } else {
      verdict(d, "REVIEW_REQUIRED"); expect(d["phase_complete"] === false, "Non-support semantic evidence passed");
      expect(codes.includes(outcome === "contradicted" ? "SEMANTIC_CONTRADICTION" : "SEMANTIC_UNCERTAIN"), `Expected actual ${outcome} semantic class`);
      if (outcome === "contradicted") expect(typeof contradiction === "number" && contradiction >= 0.95, "Confident contradiction was not observed");
      else expect(typeof support === "number" && typeof contradiction === "number" && contradiction < 0.95 && !(support >= 0.95 && contradiction <= 0.05), "Incomplete observation did not fall in the adopted uncertainty region");
    }
    } catch (error) { failures.push(`${id}: ${error instanceof Error ? error.message : "Unknown calibration failure"}`); }
  }
  await jsonFile(join(output, "calibration-observations.json"), { schema_version: 1, fixture_sha256: calibration.fixtureDigest, adoption_sha256: calibration.adoptionDigest, amendment_sha256: calibration.amendmentDigest, mapping_sha256: calibration.mappingDigest, rubric_version: calibration.rubricVersion, observations, failures });
  expect(failures.length === 0, failures.join("; "));
  expect(observations.length === 3, "All three adopted calibration classes must be observed in this run");
  successfulCalibration = calibration;
});

await one("real-local-hook-bridge", async () => {
  const f = await fixture("host-bridge", { external: true });
  const env = { ...process.env, PHASE_EXIT_BINARY: binary, PHASE_EXIT_CONTRACT: f.contractPath, PHASE_EXIT_EVIDENCE: f.evidencePath, PHASE_EXIT_STAGE: "accept", PHASE_EXIT_STATE_DIR: f.state };
  const response = await run(process.execPath, [join(root, "packages", "harnesses", "cli.js"), "codex", "stop"], env, JSON.stringify({ session_id: "bounded-codex-fixture", stop_hook_active: false }));
  expect(response.exit_code === 0, "Local hook bridge process failed");
  const result = object(JSON.parse(response.stdout));
  expect(result["continue"] === false && text(result["stopReason"]).includes("BLOCKED"), "Blocked phase was continued or presented as success");
  const continuing = await fixture("host-continuation"); array(continuing.evidence["records"]).splice(1); await jsonFile(continuing.evidencePath, continuing.evidence);
  const continuationEnv = { ...env, PHASE_EXIT_CONTRACT: continuing.contractPath, PHASE_EXIT_EVIDENCE: continuing.evidencePath, PHASE_EXIT_STATE_DIR: continuing.state };
  const input = JSON.stringify({ session_id: "bounded-continuation", stop_hook_active: false });
  const first = object(JSON.parse((await run(process.execPath, [join(root, "packages", "harnesses", "cli.js"), "codex", "stop"], continuationEnv, input)).stdout));
  expect(first["decision"] === "block", "Approved remaining action was not offered once");
  const second = object(JSON.parse((await run(process.execPath, [join(root, "packages", "harnesses", "cli.js"), "codex", "stop"], continuationEnv, input)).stdout));
  expect(second["continue"] === false, "Same fingerprint recursively requested continuation");
});
await one("native-package-install-and-skills", async () => {
  const definitions: [string, string][] = [["claude", ".claude-plugin/plugin.json"], ["codex", ".codex-plugin/plugin.json"], ["opencode", "package.json"], ["kimi", "kimi.plugin.json"], ["deepseek", "package.json"]];
  for (const [host, manifest] of definitions) {
    const destination = join(output, `installed-${host}`);
    const install = await run(process.execPath, [join(root, "scripts", "install.js"), host, destination]);
    expect(install.exit_code === 0, `${host} package install failed`);
    object(JSON.parse(await readFile(join(destination, manifest), "utf8")));
    expect((await lstat(join(destination, "runtime", "packages", "harnesses", "bridge.js"))).isFile(), `${host} compiled runtime missing`);
    for (const skill of ["phase-contract", "phase-exit"]) {
      const canonical = await readFile(join(project, "skills", skill, "SKILL.md"));
      const installed = await readFile(join(destination, "skills", skill, "SKILL.md"));
      expect(hash(canonical) === hash(installed), `${host}/${skill} differs from canonical skill`);
      const markdown = installed.toString("utf8");
      expect(markdown.startsWith(`---\nname: ${skill}\n`) && /^description: .{1,1024}$/m.test(markdown) && /^license: Apache-2.0$/m.test(markdown), `${host}/${skill} frontmatter contract missing`);
      const references = await readdir(join(destination, "skills", skill, "references"));
      expect(references.length > 0, `${host}/${skill} progressive references missing`);
    }
    expect((await lstat(join(destination, "LICENSE"))).isFile(), `${host} distribution license missing`);
  }
  const skillRoot = join(output, "local-skills");
  expect((await run(process.execPath, [join(root, "scripts", "install-skills.js"), skillRoot])).exit_code === 0, "Canonical local skill installation failed");
  expect((await run(process.execPath, [join(root, "scripts", "install-skills.js"), skillRoot])).exit_code === 0, "Identical local installation was not idempotent");
  await writeFile(join(skillRoot, "phase-exit", "SKILL.md"), "Existing operator modification\n");
  expect((await run(process.execPath, [join(root, "scripts", "install-skills.js"), skillRoot])).exit_code !== 0, "Installer overwrote differing operator skill");
});
await one("real-uar-import", async () => {
  const uar = process.env.PHASE_EXIT_UAR_ROOT;
  expect(Boolean(uar), "PHASE_EXIT_UAR_ROOT required for real UAR import; example fixture alone is insufficient");
  if (!uar) return;
  const calibration = successfulCalibration;
  expect(calibration !== undefined && (retainedCalibrationProof !== null || cases.some(c => c.id === "jev-live-frozen-calibration" && c.passed)), "Real UAR adoption withheld: adopted v2 JEV calibration has no same-run pass or validated retained proof");
  if (!calibration) return;
  const calibrationAuthority = retainedCalibrationProof ? `Retained passing calibration proof ${text(retainedCalibrationProof["path"])} SHA-256 ${text(retainedCalibrationProof["sha256"])}; original observations retained without reevaluation.` : "Calibration passed in this run.";
  const adoptionAuthority = `Operator-approved Phase Exit/UAR implementation plan and explicit instruction to adopt the reviewed calibration amendment, continue Phase Exit, and resume UAR v1.1.1. Calibration adoption ${calibration.adoptionDigest}; mapping ${calibration.mappingDigest}; frozen fixture ${calibration.fixtureDigest}. ${calibrationAuthority}`;
  const phase = join(uar, ".kbd-orchestrator", "phases", "uar-outstanding-issues-v1-1-1");
  const manifest = join(phase, "evidence", "gates", "local.json");
  const manifestValue = object(JSON.parse(await readFile(manifest, "utf8")));
  const inventoryPath = process.env.PHASE_EXIT_UAR_INVENTORY ?? join(phase, "implementation-inventory-20261016-03.json");
  const inventory = { path: inventoryPath, sha256: hash(await readFile(inventoryPath)) };
  const imported = await importUarSnapshot({ root: uar, output: join(output, "uar-snapshot"), inventory, receipts: [{ manifest, receipt: join(text(manifestValue["evidence_root"]), "receipt.json") }], adoptionReference: adoptionAuthority });
  expect(imported.ok, imported.ok ? "" : imported.error.code);
  if (!imported.ok) return;
  const ledger = object(JSON.parse(await readFile(join(phase, "execution-ledger.json"), "utf8")));
  const implementationIds = array(ledger["tasks"]).map(object).filter(task => task["kind"] === "implementation").map(task => text(task["stable_id"]));
  expect(new Set(implementationIds).size === implementationIds.length && imported.value.implementationItems === implementationIds.length && imported.value.imageScenarios === 76 && imported.value.nativeSupplements === 4, "UAR count reconciliation differs from the exact approved ledger scope");
  expect(GROUPS.length === 6 && NATIVE_SUPPLEMENTS.length === 4 && GROUPS.reduce((n, group) => n + IMAGE_SCENARIOS[group].length, 0) === 76, "UAR adapter exported a different scope");
  const f: Fixture = { dir: join(output, "uar-snapshot"), state: join(output, "uar-state"), contractPath: imported.value.contract, evidencePath: imported.value.evidence, digest: imported.value.contractDigest, contract: object(JSON.parse(await readFile(imported.value.contract, "utf8"))), evidence: object(JSON.parse(await readFile(imported.value.evidence, "utf8"))) };
  const rejectedInventory = await importUarSnapshot({ root: uar, output: join(output, "uar-rejected-inventory"), inventory: { ...inventory, sha256: "0".repeat(64) }, receipts: [] });
  expect(!rejectedInventory.ok && rejectedInventory.error.code === "INVENTORY_REFERENCE_DIGEST_MISMATCH", "Explicit inventory digest mismatch did not stop collection");
  if (ledger["boundary"] !== "open" || object(ledger["validation_scope"])["boundary"] !== "open") {
    const snapshot = object(JSON.parse(await readFile(imported.value.snapshot, "utf8")));
    expect(snapshot["implementation_complete"] === false && array(snapshot["receipts"]).map(object).every(row => row["current"] === false), "Closed repair boundary accepted a historical inventory or receipt as current");
  }
  await adopt(f, null, [], { reviewer: "phase-exit-import-mapping-conformance", reviewRationale: "Check imported artifact identity and operator-approved mapping conformance only; this is not another UAR source review and does not expand its review cap or scope.", operator: "gqadonis", rationale: adoptionAuthority });
  const pendingSnapshot = object(JSON.parse(await readFile(imported.value.snapshot, "utf8")));
  const pendingLocal = array(pendingSnapshot["pending_manifests"] ?? []).map(object).some(row => row["original_manifest"] === manifest && row["manifest_current"] === true && row["receipt_observation"] === "absent");
  const localOriginalAbsent = await lstat(join(text(manifestValue["evidence_root"]), "receipt.json")).then(() => false, (error: unknown) => {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return true;
    throw error;
  });
  if (localOriginalAbsent && pendingSnapshot["implementation_complete"] === true && object(manifestValue["implementation_inventory"])["digest"] === `sha256:${inventory.sha256}`) expect(pendingLocal, "Fresh canonical manifest with absent original receipt was not retained as pending");
  if (pendingLocal) {
    expect(!array(pendingSnapshot["receipts"]).map(object).some(row => row["original_manifest"] === manifest), "Missing original receipt became a fabricated runtime observation");
    const localDecision = await evaluate(f, "local");
    verdict(localDecision, "CONTINUE");
    expect(object(localDecision["next_authorized_action"])["id"] === "uar-local-acceptance" && localDecision["phase_complete"] === false, "Fresh canonical local collection gate was not authorized exactly");
    expect(!array(f.evidence["records"]).map(object).some(row => text(row["criterion_id"]).startsWith("local-") || text(row["criterion_id"]).startsWith("native-")), "Unobserved local acceptance was represented as observed evidence");
    await jsonFile(join(output, "uar-pending-local-decision.json"), localDecision);
  }
  const d = await evaluate(f, "release");
  expect(d["phase_complete"] === false, "Incomplete real UAR phase was certified");
  expect(array(f.contract["criteria"]).map(object).some(criterion => criterion["id"] === "qualified-supervisor"), "Mandatory external qualification disappeared from the UAR contract");
  const evidenceSnapshot = object(JSON.parse(await readFile(imported.value.snapshot, "utf8")));
  const supervisorReady = array(evidenceSnapshot["receipts"]).map(object).some(receipt => receipt["current"] === true && receipt["identity_valid"] === true && receipt["raw_valid"] === true && receipt["supervisor_qualification"] === true);
  expect(array(d["unmet_criteria"]).includes("qualified-supervisor") === !supervisorReady, "Supervisor decision disagrees with retained current physical qualification evidence");
  await jsonFile(join(output, "uar-decision.json"), d);
});

const passed = cases.every(c => c.passed);
await jsonFile(join(output, "receipt.json"), { schema_version: 1, status: passed ? "passed" : "failed", platform: `${process.platform}-${process.arch}`, node: process.version, binary_sha256: hash(await readFile(binary)), cases: cases.map(c => ({ ...c })), commands, retained_calibration_proof: retainedCalibrationProof, limitations: ["Controlled transport fixtures do not establish live service behavior", "Native package validation is separate from actual host execution", "UAR publication remains subject to its own adopted gates"] });
process.stdout.write(JSON.stringify({ status: passed ? "passed" : "failed", cases: cases.length, failed: cases.filter(c => !c.passed).map(c => c.id), receipt: join(output, "receipt.json") }) + "\n");
process.exitCode = passed ? 0 : 1;
