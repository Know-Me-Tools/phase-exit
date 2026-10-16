process.argv = [process.execPath, import.meta.filename, "codex", "tool"];
await import("./cli.js");
