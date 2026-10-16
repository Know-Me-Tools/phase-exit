/** Bounded, serialized acceptance. Invoke only after the full implementation inventory. */
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
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
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(root, "..");
const binary = process.env.PHASE_EXIT_BINARY ?? join(project, "target", "debug", "phase-exit");
const output = resolve(process.env.PHASE_EXIT_ACCEPTANCE_OUTPUT ?? join(project, ".phase-exit", "private", `acceptance-${Date.now()}`));
const cases: CaseReceipt[] = [];
const commands: Obj[] = [];
const selectedCases = process.env.PHASE_EXIT_ACCEPTANCE_CASES?.split(",").filter(Boolean);
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
  await jsonFile(join(output, "receipt.json"), { schema_version: 1, status: "running", cases: cases.map(c => ({ ...c })), commands });
  process.stdout.write(`${id}: ${cases.at(-1)?.passed ? "PASS" : "FAIL"}\n`);
}
async function adopt(f: Fixture, previous: string | null = null, invalidated: string[] = []): Promise<void> {
  await jsonFile(f.contractPath, f.contract);
  const imported = await cli(["contract", "import", "--contract", f.contractPath, "--state-dir", f.state]);
  f.digest = text(imported["contract_digest"]);
  const reviewed = await cli(["contract", "freeze", "--contract", f.contractPath, "--reviewer", "bounded-acceptance-fixture", "--rationale", "Operator approved isolated acceptance fixtures; not UAR adoption", "--state-dir", f.state]);
  const adoption = await jsonFile(join(f.dir, `adoption-${String(f.contract["revision"])}.json`), {
    schema_version: 1, contract_digest: f.digest, review_digest: reviewed["review_digest"] ?? null,
    previous_contract_digest: previous, operator: "approved-fixture-program", rationale: "Exercise explicitly approved isolated fixture authority", invalidated_criteria: invalidated,
  });
  await cli(["contract", "adopt", "--contract", f.contractPath, "--adoption", adoption, "--state-dir", f.state]);
}
async function fixture(name: string, options: { publication?: boolean; external?: boolean; semantic?: string; hooks?: Obj; failedCommand?: boolean; repair?: boolean; secondGate?: boolean } = {}): Promise<Fixture> {
  const dir = join(output, name); await mkdir(dir, { recursive: true });
  const source = join(dir, "approved-plan.md"); await writeFile(source, "Frozen bounded acceptance example approved in the Phase Exit plan.\n");
  const sourceHash = hash(await readFile(source));
  const implementation = join(dir, "implementation.json"); await jsonFile(implementation, { complete: true });
  const criteria: Json[] = [{ id: "implementation", stage: "implement", description: "Complete fixture implementation artifact", expected_outcome: "All approved implementation exists", source_id: "plan", depends_on: [], predicate: { kind: "file_sha256", sha256: hash(await readFile(implementation)) } }];
  const actions: Json[] = [{ id: "accept-command", stage: "accept", kind: "gate", executable: process.execPath, argv: [join(root, "tests", "fixture-command.js"), options.failedCommand ? "failure" : "success"], cwd: project, repairs_criteria: [], covers_criteria: ["acceptance"] }];
  let predicate: Obj = { kind: "command_success", action_id: "accept-command" };
  if (options.external) predicate = { kind: "external_ready", pointer: "/available" };
  if (options.semantic) predicate = { kind: "semantic", pointer: "/statement", question: "Does the supplied original receipt establish that the command finished successfully with exit code zero?" };
  criteria.push({ id: "acceptance", stage: "accept", description: "The recorded command finished successfully with exit code zero.", expected_outcome: "A terminal success with exit code zero is observed", source_id: "plan", depends_on: ["implementation"], predicate });
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
    identity: { source: sourceHash, fixture: "bounded-v1", platform: `${process.platform}-${process.arch}` },
    exclusions: ["Windows qualification", "Unrelated product tests"], prerequisites: options.external ? ["acceptance"] : [],
    boundary: { implementation_stages: ["implement"] }, retry_limits: { max_attempts: 3, max_elapsed_seconds: 60 },
    jev: { model: "jev-1.14.0", rubric_version: "bounded-v1", support_threshold: 0.95, contradiction_threshold: 0.05 },
    sources: ["assessment", "analysis", "specification", "plan"].map(role => ({ id: role, role, path: source, sha256: sourceHash })), conflicts: [], stages, criteria, actions, hooks: options.hooks ?? null,
  };
  const f: Fixture = { dir, state: join(dir, "state"), contractPath: join(dir, "contract.json"), evidencePath: join(dir, "evidence.json"), contract, evidence: {}, digest: "" };
  await adopt(f);
  f.evidence = { schema_version: 1, contract_digest: f.digest, records: [await receipt(f, "implementation", implementation)] };
  if (options.external) {
    const artifact = await jsonFile(join(dir, "external.json"), { available: false, reason: "Required genuine collaborator is unavailable" });
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
const verdict = (d: Obj, expected: string): void => expect(d["verdict"] === expected, `Expected ${expected}, observed ${String(d["verdict"])}: ${JSON.stringify(d["reasons"])}`);

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
  const set = object(JSON.parse(await readFile(join(project, "fixtures", "semantic-examples.json"), "utf8")));
  const observations: Obj[] = [];
  const failures: string[] = [];
  for (const item of array(set["examples"])) {
    const example = object(item); const id = text(example["id"]);
    try {
    const resumeRoot = process.env.PHASE_EXIT_CALIBRATION_RESUME_ROOT;
    let f: Fixture;
    const resumed = resumeRoot ? join(resumeRoot, `jev-live-${id}`) : null;
    const exists = resumed ? await lstat(resumed).then(() => true, error => { if (object(error)["code"] === "ENOENT") return false; throw error; }) : false;
    if (resumed && exists) {
      const contractPath = join(resumed, "contract.json"); const evidencePath = join(resumed, "evidence.json");
      f = { dir: resumed, state: join(resumed, "state"), contractPath, evidencePath, contract: object(JSON.parse(await readFile(contractPath, "utf8"))), evidence: object(JSON.parse(await readFile(evidencePath, "utf8"))), digest: "" };
    } else {
      f = await fixture(`jev-live-${id}`, { semantic: text(object(example["evidence"])["statement"]) });
    }
    const d = await evaluate(f);
    const outcome = text(example["expected_semantic_outcome"]);
    const cache = await readdir(join(f.state, "jev-cache"));
    expect(cache.length === 1, "Calibration requires one retained validated live judgment");
    const judgment = object(JSON.parse(await readFile(join(f.state, "jev-cache", cache[0] ?? "missing"), "utf8")));
    expect(judgment["live"] === true && judgment["model"] === "jev-1.14.0", "Calibration lacks exact preview-model live observation");
    const support = judgment["support"]; const contradiction = judgment["contradiction"];
    expect(typeof support === "number" && typeof contradiction === "number", "Calibration probabilities missing");
    const codes = array(d["reasons"]).map(reason => object(reason)["code"]);
    expect(!codes.includes("JEV_UNAVAILABLE"), "Service failure is not a semantic calibration result");
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
    } else {
      verdict(d, "REVIEW_REQUIRED"); expect(d["phase_complete"] === false, "Non-support semantic evidence passed");
      expect(codes.includes(outcome === "contradicted" ? "SEMANTIC_CONTRADICTION" : "SEMANTIC_UNCERTAIN"), `Expected actual ${outcome} semantic class`);
      if (outcome === "contradicted") expect(typeof contradiction === "number" && contradiction >= 0.95, "Confident contradiction was not observed");
    }
    } catch (error) { failures.push(`${id}: ${error instanceof Error ? error.message : "Unknown calibration failure"}`); }
  }
  await jsonFile(join(output, "calibration-observations.json"), { schema_version: 1, observations, failures });
  expect(failures.length === 0, failures.join("; "));
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
  const phase = join(uar, ".kbd-orchestrator", "phases", "uar-outstanding-issues-v1-1-1");
  const manifest = join(phase, "evidence", "gates", "local.json");
  const manifestValue = object(JSON.parse(await readFile(manifest, "utf8")));
  const imported = await importUarSnapshot({ root: uar, output: join(output, "uar-snapshot"), receipts: [{ manifest, receipt: join(text(manifestValue["evidence_root"]), "receipt.json") }], adoptionReference: "operator-approved Phase Exit implementation plan, UAR mapping and bounded acceptance" });
  expect(imported.ok, imported.ok ? "" : imported.error.code);
  if (!imported.ok) return;
  expect(imported.value.implementationItems === 19 && imported.value.imageScenarios === 76 && imported.value.nativeSupplements === 4, "UAR count reconciliation differs from approved scope");
  expect(GROUPS.length === 6 && NATIVE_SUPPLEMENTS.length === 4 && GROUPS.reduce((n, group) => n + IMAGE_SCENARIOS[group].length, 0) === 76, "UAR adapter exported a different scope");
  expect(cases.some(c => c.id === "jev-live-frozen-calibration" && c.passed), "Real UAR adoption withheld: frozen JEV calibration did not pass");
  const f: Fixture = { dir: join(output, "uar-snapshot"), state: join(output, "uar-state"), contractPath: imported.value.contract, evidencePath: imported.value.evidence, digest: imported.value.contractDigest, contract: object(JSON.parse(await readFile(imported.value.contract, "utf8"))), evidence: object(JSON.parse(await readFile(imported.value.evidence, "utf8"))) };
  await adopt(f);
  const d = await evaluate(f, "release");
  expect(d["phase_complete"] === false, "Incomplete real UAR phase was certified");
  expect(array(d["unmet_criteria"]).includes("qualified-supervisor"), "Mandatory external qualification disappeared from UAR decision");
  await jsonFile(join(output, "uar-decision.json"), d);
});

const passed = cases.every(c => c.passed);
await jsonFile(join(output, "receipt.json"), { schema_version: 1, status: passed ? "passed" : "failed", platform: `${process.platform}-${process.arch}`, node: process.version, binary_sha256: hash(await readFile(binary)), cases: cases.map(c => ({ ...c })), commands, limitations: ["Controlled transport fixtures do not establish live service behavior", "Native package validation is separate from actual host execution", "UAR publication remains subject to its own adopted gates"] });
process.stdout.write(JSON.stringify({ status: passed ? "passed" : "failed", cases: cases.length, failed: cases.filter(c => !c.passed).map(c => c.id), receipt: join(output, "receipt.json") }) + "\n");
process.exitCode = passed ? 0 : 1;
