import type { HookContext, HookDefinition, HookEvent, HookOutput } from "./types.js";
export declare function eventName(value: unknown): HookEvent;
export declare function context(value: unknown): HookContext;
export declare function configuration(value: unknown): HookDefinition[];
export declare function output(value: unknown): HookOutput;
