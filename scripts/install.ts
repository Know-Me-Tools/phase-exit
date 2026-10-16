import { lstat, mkdir, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { copyTree } from "../packages/distribution/files.js";

try {
  const host = process.argv[2];
  const destinationArg = process.argv[3];
  if (!host || !["claude", "codex", "opencode", "kimi", "deepseek"].includes(host) || !destinationArg || process.argv.length !== 4) throw new Error("Expected HOST DESTINATION");
  const destination = resolve(destinationArg);
  try {
    await lstat(destination);
    throw new Error("Destination already exists");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const staging = join(dirname(destination), `.phase-exit-install-${randomUUID()}`);
  await mkdir(staging, { recursive: false });
  try {
    await copyTree(join(root, "artifacts", "plugins", host), staging);
    await rename(staging, destination);
  } catch (error) { await rm(staging, { recursive: true, force: true }); throw error; }
  process.stdout.write(JSON.stringify({ schema_version: 1, host, installed_path: destination, activation_required: true, qualification: "not_run" }) + "\n");
} catch {
  process.stderr.write("Install failed: supply a built host artifact and a new destination with an existing parent directory.\n");
  process.exitCode = 1;
}
