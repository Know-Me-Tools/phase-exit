import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const names = ["phase-contract", "phase-exit"] as const;
type SkillName = typeof names[number];
interface Receipt {
  skill: SkillName;
  path: string;
  status: "installed" | "already_installed" | "refused";
  reason: string;
}

async function inventory(directory: string, relative = ""): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("Skill directory must be a real directory");
  result.set(relative, "directory");
  for (const name of (await readdir(directory)).sort()) {
    const path = join(directory, name);
    const key = relative ? `${relative}/${name}` : name;
    const item = await lstat(path);
    if (item.isSymbolicLink()) throw new Error("Skill trees must not contain symbolic links");
    if (item.isDirectory()) {
      for (const [entry, value] of await inventory(path, key)) result.set(entry, value);
    } else if (item.isFile()) {
      result.set(key, createHash("sha256").update(await readFile(path)).digest("hex"));
    } else throw new Error("Skill trees must contain only files and directories");
  }
  return result;
}

async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; }
  catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return false;
    throw error;
  }
}

async function copyExclusive(source: string, destination: string): Promise<void> {
  // Each directory and file is acquired exclusively, including the skill root.
  await mkdir(destination);
  for (const name of await readdir(source)) {
    const from = join(source, name);
    const to = join(destination, name);
    const item = await lstat(from);
    if (item.isSymbolicLink()) throw new Error("Symbolic links are unsupported");
    if (item.isDirectory()) await copyExclusive(from, to);
    else if (item.isFile()) await copyFile(from, to, constants.COPYFILE_EXCL);
    else throw new Error("Unsupported skill input");
  }
}

const results: Receipt[] = [];
try {
  const destinationArg = process.argv[2];
  if (!destinationArg || process.argv.length !== 3) throw new Error("Expected one destination skill root");
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const destinationRoot = resolve(destinationArg);
  const pending: { skill: SkillName; source: string; destination: string }[] = [];
  // Read both complete trees before writing either; an existing conflict refuses
  // the whole operation instead of producing a partially updated skill pair.
  for (const skill of names) {
    const source = join(root, "skills", skill);
    const destination = join(destinationRoot, skill);
    const expected = await inventory(source);
    if (!expected.has("SKILL.md")) throw new Error("Canonical SKILL.md missing");
    if (await exists(destination)) {
      const actual = await inventory(destination);
      const identical = expected.size === actual.size && [...expected].every(([path, hash]) => actual.get(path) === hash);
      results.push({ skill, path: destination, status: identical ? "already_installed" : "refused", reason: identical ? "Existing files match the canonical skill exactly." : "Destination differs; no files overwritten. Move it explicitly before installing." });
    } else pending.push({ skill, source, destination });
  }
  if (results.some(result => result.status === "refused")) {
    for (const item of pending) results.push({ skill: item.skill, path: item.destination, status: "refused", reason: "Another canonical skill has a conflicting destination; nothing installed." });
    process.exitCode = 1;
  } else {
    await mkdir(destinationRoot, { recursive: true });
    const rootInfo = await lstat(destinationRoot);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) throw new Error("Destination skill root must be a real directory");
    for (const item of pending) {
      await copyExclusive(item.source, item.destination);
      results.push({ skill: item.skill, path: item.destination, status: "installed", reason: "Copied complete canonical skill with references; no symlinks or overwrite." });
    }
  }
  process.stdout.write(`${JSON.stringify({ schema_version: 1, results })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ schema_version: 1, results, error: error instanceof Error ? error.message : "Skill installation failed", policy: "Existing files were not overwritten. A newly created partial directory may require explicit removal before retry." })}\n`);
  process.exitCode = 1;
}
