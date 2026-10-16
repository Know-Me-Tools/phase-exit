import type { Context } from "@deepseek-ai/cordis";
import type { PreStepDecision } from "@deepseek-ai/dsh-agent";
import type { PreToolDecision } from "@deepseek-ai/dsh-tools";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { parse } from "../hooks/json.js";
import type { Json } from "../hooks/types.js";
import { authorizeTool, evaluate, handleStop, loadConfig } from "./bridge.js";

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap { "phase-exit": { kind: "phase-exit" } }
}

export const name = "phase-exit";
export const inject = ["tools"];

export function apply(ctx: Context): void {
  const decisions = new Map<symbol, string | null>();
  ctx.on("tools/pre-execute", async (execution, next): Promise<PreToolDecision> => {
    try {
      const result = await authorizeTool(await loadConfig(), execution.name, parse(JSON.stringify(execution.arguments)) as Json, execution.agent?.session.header.cwd ?? process.cwd());
      decisions.set(execution.token, result.allowed ? null : result.reason);
      if (!result.allowed) return { kind: "deny", reason: result.reason };
      return await next();
    } catch {
      const reason = "Phase Exit: INVALID authorization state.";
      decisions.set(execution.token, reason);
      return { kind: "deny", reason };
    }
  });
  const releaseGuard = ctx.tools.guard(execution => {
    const result = decisions.get(execution.token);
    return result === null ? undefined : (result ?? "Phase Exit: missing authorization receipt for tool execution.");
  });
  ctx.on("tools/result", execution => { decisions.delete(execution.token); });
  ctx.effect(() => releaseGuard);
  ctx.on("agent/pre-step", async (payload, next): Promise<PreStepDecision> => {
    if (payload.signal.aborted) return { kind: "reject" };
    try {
      const decision = await evaluate(await loadConfig());
      if (["WAIT", "BLOCKED", "REVIEW_REQUIRED", "INVALID"].includes(decision.verdict)) {
        process.stderr.write(`Phase Exit: ${decision.verdict}; phase incomplete; yielding.\n`);
        return { kind: "reject" };
      }
      return await next();
    } catch {
      process.stderr.write("Phase Exit: INVALID pre-step state; yielding.\n");
      return { kind: "reject" };
    }
  });
  ctx.on("agent/turn-stopping", async payload => {
    if (payload.signal.aborted) return;
    try {
      const result = await handleStop(await loadConfig(), payload.agent.session.id, payload.signal.aborted);
      process.stderr.write(`${result.message}\n`);
      if (result.request_continuation && !payload.signal.aborted) payload.agent.steer(createUserMessage({ content: [{ type: "text", text: result.message }], source: { kind: "phase-exit" } }));
    } catch {
      process.stderr.write("Phase Exit: INVALID stop state; no continuation requested.\n");
    }
  });
}
