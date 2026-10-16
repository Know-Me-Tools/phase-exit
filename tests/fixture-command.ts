// Real subprocess collaborator for the bounded CLI/filesystem acceptance program.
const mode = process.argv[2];
if (mode !== "success" && mode !== "failure") {
  process.stderr.write("Unknown approved fixture command mode\n");
  process.exitCode = 2;
} else {
  process.stdout.write(JSON.stringify({ observed: "fixture-command", mode }) + "\n");
  if (mode === "failure") {
    process.stderr.write("Observed controlled command failure\n");
    process.exitCode = 7;
  }
}
