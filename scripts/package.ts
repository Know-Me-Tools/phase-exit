import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { copyTree } from "../packages/distribution/files.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const hosts = ["claude", "codex", "opencode", "kimi", "deepseek"] as const;
// This target copies production outputs only and never invokes checks or installs.
try {
  for (const host of hosts) {
    const plugin = join(root, "plugins", host);
    await mkdir(join(plugin, "runtime"), { recursive: true });
    await copyTree(join(root, "dist", "packages"), join(plugin, "runtime", "packages"));
    await writeFile(join(plugin, "runtime", "package.json"), JSON.stringify({ type: "module" }, null, 2));
    await copyTree(join(root, "skills"), join(plugin, "skills"));
    await writeFile(join(plugin, "LICENSE"), await readFile(join(root, "LICENSE")));
    await mkdir(join(plugin, "docs"), { recursive: true });
    await writeFile(join(plugin, "docs", "typescript-interface.md"), await readFile(join(root, "docs", "typescript-interface.md")));
    await writeFile(join(plugin, "docs", "rust-interface.md"), await readFile(join(root, "docs", "rust-interface.md")));
    await writeFile(join(plugin, "docs", "capabilities.md"), await readFile(join(root, "docs", "capabilities.md")));
  }
  await mkdir(join(root, "artifacts"), { recursive: true });
  for (const host of hosts) await copyTree(join(root, "plugins", host), join(root, "artifacts", "plugins", host));
  // Repository marketplaces stay beside plugin roots in the archive tree.
  for (const path of [".claude-plugin/marketplace.json", ".agents/plugins/marketplace.json", "kimi-marketplace.json"]) {
    const source = join(root, path);
    const destination = join(root, "artifacts", path);
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, await readFile(source));
  }
  process.stdout.write(JSON.stringify({ schema_version: 1, packages: hosts.map(host => join(root, "artifacts", "plugins", host)), tracked_runtime: join(root, "plugins") }) + "\n");
} catch {
  process.stderr.write("Packaging failed: production compiled output, canonical skills or manifests unavailable.\n");
  process.exitCode = 1;
}
