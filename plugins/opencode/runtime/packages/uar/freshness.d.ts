export declare function sha256(bytes: Uint8Array | string): string;
export declare function contained(root: string, path: string): boolean;
export declare function sourceIdentity(root: string, paths: readonly string[]): Promise<string>;
/** Rechecks mutable UAR source at evaluation; it never runs acceptance or mutates UAR. */
export declare function checkFreshness(snapshotPath: string): Promise<void>;
export declare function run(_input: unknown): Promise<{
    schema_version: 1;
    veto: boolean;
    reason: string;
}>;
