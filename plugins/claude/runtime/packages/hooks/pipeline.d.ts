import type { HookContext, HookEvent, HookRunResult } from "./types.js";
export declare function runHooks(event: HookEvent, context: HookContext): Promise<HookRunResult>;
