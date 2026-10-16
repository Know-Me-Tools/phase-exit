import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { join } from "node:path";
import { readBounded } from "../packages/hooks/json.js";

export function literalKey(profile: string): string {
  const assignments = profile.split(/\r?\n/).filter(line => /^\s*(?:export\s+)?JEV_API_KEY\s*=/.test(line));
  if (assignments.length !== 1) throw new Error("Exactly one literal JEV_API_KEY assignment required");
  const line = assignments[0];
  if (!line) throw new Error("Missing assignment");
  const match = /^\s*(?:export\s+)?JEV_API_KEY\s*=\s*(?:'([^'\r\n]*)'|"([^"\r\n]*)"|([^\s'"#;]+))\s*(?:#.*)?$/.exec(line);
  const key = match?.[1] ?? match?.[2] ?? match?.[3];
  if (!key || /[$`\\\r\n]/.test(key)) throw new Error("Key assignment must be literal; substitutions forbidden");
  return key;
}
try {
  const args = process.argv.slice(2);
  let profile = join(homedir(), ".bash_profile");
  if (args[0] === "--profile") {
    const selected = args[1];
    if (!selected) throw new Error("Profile path required");
    profile = selected;
    args.splice(0, 2);
  }
  if (args[0] === "--") args.shift();
  const executable = args.shift();
  if (!executable) throw new Error("Executable required");
  const key = process.env["JEV_API_KEY"] || literalKey((await readBounded(profile)).toString("utf8"));
  const env: NodeJS.ProcessEnv = { ...process.env, JEV_API_KEY: key };
  delete env["NODE_OPTIONS"];
  const child = spawn(executable, args, { shell: false, env, stdio: "inherit", windowsHide: true });
  child.once("error", () => { process.stderr.write("Unable to launch credential-scoped executable.\n"); process.exitCode = 14; });
  child.once("exit", code => { process.exitCode = code ?? 14; });
} catch {
  process.stderr.write("Unable to obtain literal JEV_API_KEY or invalid bootstrap arguments; profile was not executed.\n");
  process.exitCode = 14;
}
