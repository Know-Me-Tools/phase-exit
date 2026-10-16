import { parse, readBounded } from "./json.js";
import { runHooks } from "./pipeline.js";
import { context, eventName } from "./validation.js";

try {
  const event = eventName(process.argv[2]);
  const path = process.argv[3];
  if (!path || process.argv.length !== 4) throw new Error("Expected EVENT CONTEXT_FILE");
  const result = await runHooks(event, context(parse(await readBounded(path))));
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch {
  process.stdout.write(`${JSON.stringify({ schema_version: 1, blocked: true, error: "Invalid hook bridge, integrity, recursion or storage state" })}\n`);
  process.exitCode = 14;
}
