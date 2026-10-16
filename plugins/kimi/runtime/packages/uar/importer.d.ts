import type { ImportOptions, ImportOutput, Result } from './types.js';
export declare function canonicalJson(value: unknown): string;
/** Reads UAR and writes a NEW private snapshot directory only. Never invokes a product gate. */
export declare function importUarSnapshot(options: ImportOptions): Promise<Result<ImportOutput>>;
