import { MAX_BYTES, object } from "./json.js";

// IPC is separate from module stdout/stderr, which the parent discards.
process.once("message", (message: unknown) => {
  void (async () => {
    try {
      if (!object(message) || typeof message["source"] !== "string" || !object(message["input"])) throw new Error("Invalid worker input");
      const imported: unknown = await import(`data:text/javascript;base64,${Buffer.from(message["source"]).toString("base64")}`);
      if (typeof imported !== "object" || imported === null || !("run" in imported) || typeof imported.run !== "function") throw new Error("Missing run export");
      const result: unknown = await imported.run(message["input"]);
      const serialized = JSON.stringify(result);
      if (typeof serialized !== "string" || Buffer.byteLength(serialized) > MAX_BYTES) throw new Error("Invalid output size");
      process.send?.({ ok: true, result: JSON.parse(serialized) as unknown }, undefined, undefined, () => process.exit(0));
    } catch {
      process.send?.({ ok: false }, undefined, undefined, () => process.exit(1));
    }
  })();
});
