import type { Context } from "@deepseek-ai/cordis";
declare module "@deepseek-ai/dsh-llm" {
    interface MessageSourceMap {
        "phase-exit": {
            kind: "phase-exit";
        };
    }
}
export declare const name = "phase-exit";
export declare const inject: string[];
export declare function apply(ctx: Context): void;
