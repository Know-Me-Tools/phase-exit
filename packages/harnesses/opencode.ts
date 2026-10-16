import { Plugin } from "@opencode/plugin";
import { parse } from "../hooks/json.js";
import type { Json } from "../hooks/types.js";
import { authorizeTool, evaluate, handleStop, loadConfig } from "./bridge.js";

export const phaseExitPlugin = Plugin.define({
  id: "know-me-tools.phase-exit",
  async setup(ctx) {
    await ctx.tool.hook("execute.before", async event => {
      const config = await loadConfig();
      const input = parse(JSON.stringify(event.input)) as Json;
      const result = await authorizeTool(config, event.tool, input, ctx.location.directory);
      if (!result.allowed) throw new Error(result.reason);
    });
    await ctx.session.hook("context", async () => {
      const decision = await evaluate(await loadConfig());
      if (["WAIT", "BLOCKED", "REVIEW_REQUIRED", "INVALID"].includes(decision.verdict)) throw new Error(`Phase Exit: ${decision.verdict}; automatic model work stopped.`);
    });
    const controller = new AbortController();
    void (async () => {
      try {
        for await (const event of ctx.event.subscribe({ signal: controller.signal })) {
          if (event.type !== "session.idle") continue;
          // Public idle events do not distinguish a user interrupt from normal stop.
          // Observe and report, but never wake an interrupted session.
          const result = await handleStop(await loadConfig(), event.data.sessionID, true);
          process.stderr.write(`${result.message}\n`);
        }
      } catch {
        if (!controller.signal.aborted) process.stderr.write("Phase Exit: INVALID OpenCode observation state; no continuation requested.\n");
      }
    })();
    return () => controller.abort();
  },
});

export default phaseExitPlugin;
