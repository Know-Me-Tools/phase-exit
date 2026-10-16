import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { digest, MAX_BYTES, object, parse, privateName, readBounded, redact } from "./json.js";
import { configuration, output } from "./validation.js";
function hookEnvironment(names) {
    const env = { PHASE_EXIT_HOOK_ACTIVE: "1" };
    for (const name of names) {
        if (privateName(name) || /^(NODE_|PHASE_EXIT_)/i.test(name))
            continue;
        const value = process.env[name];
        if (value !== undefined && (!process.env["JEV_API_KEY"] || !value.includes(process.env["JEV_API_KEY"])))
            env[name] = value;
    }
    return env;
}
async function execute(definition, source, input) {
    return new Promise((resolveResult, reject) => {
        const child = spawn(process.execPath, [fileURLToPath(new URL("./worker.js", import.meta.url))], { shell: false, env: hookEnvironment(definition.env_allowlist), stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true });
        let settled = false;
        function finish(error, result) {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            child.kill("SIGKILL");
            if (error)
                reject(error);
            else if (result)
                resolveResult(result);
            else
                reject(new Error("Hook failed"));
        }
        const timer = setTimeout(() => finish(new Error("Hook timed out")), definition.timeout_ms);
        child.once("error", () => finish(new Error("Hook process failed")));
        child.once("exit", () => finish(new Error("Hook exited without result")));
        child.once("message", (message) => {
            try {
                if (Buffer.byteLength(JSON.stringify(message)) > MAX_BYTES || !object(message) || message["ok"] !== true)
                    throw new Error("Hook returned invalid result");
                finish(undefined, output(message["result"]));
            }
            catch {
                finish(new Error("Hook returned invalid result"));
            }
        });
        child.send({ source, input }, error => { if (error)
            finish(new Error("Hook input failed")); });
    });
}
export async function runHooks(event, context) {
    if (process.env["PHASE_EXIT_HOOK_ACTIVE"])
        throw new Error("Recursive hooks forbidden");
    const bytes = await readBounded(context.config_path);
    if (digest(bytes) !== context.config_sha256)
        throw new Error("Hook configuration digest mismatch");
    const definitions = configuration(parse(bytes));
    if (definitions.filter(definition => definition.event === event).reduce((total, definition) => total + definition.timeout_ms, 0) > 45_000)
        throw new Error("Aggregate hook timeout exceeds outer runtime budget");
    // Snapshot every configured module before any extension can run.
    const snapshots = await Promise.all(definitions.map(async (definition) => {
        const source = await readBounded(resolve(context.config_base_dir ?? dirname(context.config_path), definition.module));
        if (digest(source) !== definition.sha256)
            throw new Error("Hook module digest mismatch");
        return { definition, source };
    }));
    const invocation = `${digest(context.invocation_id)}-${randomUUID()}`;
    const snapshotDir = join(context.state_dir, "hook-snapshots", invocation);
    await mkdir(snapshotDir, { recursive: true });
    await writeFile(join(snapshotDir, "config.json"), bytes, { flag: "wx", mode: 0o600 });
    for (const [index, snapshot] of snapshots.entries())
        await writeFile(join(snapshotDir, `${index}.mjs`), snapshot.source, { flag: "wx", mode: 0o600 });
    const result = { schema_version: 1, event, blocked: false, results: [], evidence_proposals: [], amendment_proposals: [] };
    const cleaned = redact(context.payload);
    if (!object(cleaned))
        throw new Error("Invalid payload");
    const input = { schema_version: 1, event, invocation_id: context.invocation_id, payload: cleaned };
    for (const { definition, source } of snapshots) {
        if (definition.event !== event)
            continue;
        try {
            const response = await execute(definition, source.toString("utf8"), input);
            result.blocked ||= response.veto;
            const safeReason = redact(response.reason);
            result.results.push({ id: definition.id, status: response.veto ? "veto" : "ok", required: definition.required, message: typeof safeReason === "string" ? safeReason : "" });
            result.evidence_proposals.push(...response.evidence_proposals.map(proposal => redact(proposal)));
            result.amendment_proposals.push(...response.amendment_proposals.map(proposal => redact(proposal)));
        }
        catch (error) {
            result.blocked ||= definition.required;
            result.results.push({ id: definition.id, status: "failed", required: definition.required, message: error instanceof Error ? error.message : "Hook failed" });
        }
    }
    if (Buffer.byteLength(JSON.stringify(result)) > MAX_BYTES)
        throw new Error("Aggregate hook output exceeds byte limit");
    await mkdir(join(context.state_dir, "hook-receipts"), { recursive: true });
    await writeFile(join(context.state_dir, "hook-receipts", `${invocation}.json`), JSON.stringify(result, null, 2), { flag: "wx", mode: 0o600 });
    return result;
}
//# sourceMappingURL=pipeline.js.map