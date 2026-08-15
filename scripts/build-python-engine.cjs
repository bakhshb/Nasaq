#!/usr/bin/env node
/**
 * Build the Nasaq Python sidecar with PyInstaller (current OS).
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const pythonDir = path.join(root, "python");
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(pythonDir, ".venv", "Scripts", "python.exe")
  : path.join(pythonDir, ".venv", "bin", "python");

if (!fs.existsSync(venvPython)) {
  console.error(
    "Python venv missing. Run:\n  cd python && python3 -m venv .venv && pip install -e '.[dev]'",
  );
  process.exit(1);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(venvPython, ["-m", "pip", "install", "-q", "pyinstaller"]);

const outDir = path.join(root, "build", "nasaq-engine");
const workDir = path.join(root, "build", "pyinstaller-work");
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(workDir, { recursive: true });

run(venvPython, [
  "-m",
  "PyInstaller",
  "nasaq-engine.spec",
  "--noconfirm",
  "--distpath",
  outDir,
  "--workpath",
  workDir,
], { cwd: pythonDir });

const built = isWindows
  ? path.join(outDir, "nasaq-engine.exe")
  : path.join(outDir, "nasaq-engine");

if (!fs.existsSync(built)) {
  console.error(`Expected engine binary missing: ${built}`);
  process.exit(1);
}

console.log(`Built Python engine: ${built}`);
