process.argv = [process.execPath, import.meta.filename, "codex", "stop"];
await import("./cli.js");
