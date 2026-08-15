#!/usr/bin/env node
/**
 * Run Python tests using the project venv (Linux/macOS/Windows).
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

const python = fs.existsSync(venvPython) ? venvPython : isWindows ? "python" : "python3";

const result = spawnSync(python, ["-m", "pytest", "-q"], {
  cwd: pythonDir,
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? 1);
