import { createHash } from "node:crypto";
import { open } from "node:fs/promises";
import type { Json, JsonObject } from "./types.js";

export const MAX_BYTES = 1_048_576;
export function object(value: unknown): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function string(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid ${label}`);
  return value;
}
export function digest(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}
export function parse(bytes: Uint8Array | string): unknown {
  if (Buffer.byteLength(bytes) > MAX_BYTES) throw new Error("JSON exceeds byte limit");
  return JSON.parse(typeof bytes === "string" ? bytes : Buffer.from(bytes).toString("utf8")) as unknown;
}
export async function readBounded(path: string): Promise<Buffer> {
  const file = await open(path, "r");
  try {
    const bytes = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length <= MAX_BYTES) {
      const { bytesRead } = await file.read(bytes, length, bytes.length - length, null);
      if (bytesRead === 0) break;
      length += bytesRead;
    }
    if (length > MAX_BYTES) throw new Error("File exceeds byte limit");
    return bytes.subarray(0, length);
  } finally { await file.close(); }
}
export async function stdinJson(): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const part of process.stdin) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(String(part));
    bytes += chunk.length;
    if (bytes > MAX_BYTES) throw new Error("Input exceeds byte limit");
    chunks.push(chunk);
  }
  return parse(Buffer.concat(chunks));
}
const PRIVATE_NAME = /key|token|secret|password|credential|authorization|cookie/i;
export function privateName(name: string): boolean { return PRIVATE_NAME.test(name); }
export function redact(value: Json, secret = process.env["JEV_API_KEY"]): Json {
  if (typeof value === "string") return secret ? value.split(secret).join("[REDACTED]") : value;
  if (Array.isArray(value)) return value.map(item => redact(item, secret));
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, privateName(key) ? "[REDACTED]" : redact(item, secret)]));
  return value;
}
export function strictKeys(record: JsonObject, allowed: readonly string[]): void {
  if (Object.keys(record).some(key => !allowed.includes(key))) throw new Error("Unknown field");
}
