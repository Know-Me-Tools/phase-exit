import { object, stdinJson, string } from "../hooks/json.js";
import { authorizeTool, handleStop, loadConfig } from "./bridge.js";
const host = process.argv[2];
const event = process.argv[3];
try {
    if (!["claude", "codex", "kimi"].includes(host ?? "") || (event !== "stop" && event !== "tool") || process.argv.length !== 4)
        throw new Error("Invalid adapter invocation");
    const input = await stdinJson();
    if (!object(input))
        throw new Error("Invalid host payload");
    const config = await loadConfig();
    if (event === "stop") {
        const result = await handleStop(config, string(input["session_id"], "session id"), input["stop_hook_active"] === true);
        if (host === "kimi") {
            if (result.request_continuation) {
                process.stderr.write(`${result.message}\n`);
                process.exitCode = 2;
            }
            else
                process.stdout.write(`${result.message}\n`);
        }
        else {
            process.stdout.write(`${JSON.stringify(result.request_continuation ? { decision: "block", reason: result.message } : { continue: false, stopReason: result.message, systemMessage: result.message })}\n`);
        }
    }
    else {
        const result = await authorizeTool(config, string(input["tool_name"], "tool name"), input["tool_input"] ?? null, string(input["cwd"], "cwd"));
        if (!result.allowed) {
            process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: result.reason } })}\n`);
            if (host === "kimi") {
                process.stderr.write(`${result.reason}\n`);
                process.exitCode = 2;
            }
        }
        else
            process.stdout.write("{}\n");
    }
}
catch {
    const message = "Phase Exit: INVALID adapter/configuration/process state. Certification is unavailable; stop and inspect the saved state.";
    if (event === "tool") {
        process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: message } })}\n`);
        if (host === "kimi") {
            process.stderr.write(`${message}\n`);
            process.exitCode = 2;
        }
    }
    else if (host === "kimi")
        process.stdout.write(`${message}\n`);
    else
        process.stdout.write(`${JSON.stringify({ continue: false, stopReason: message, systemMessage: message })}\n`);
}
//# sourceMappingURL=cli.js.map