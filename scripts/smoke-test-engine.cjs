#!/usr/bin/env node
/**
 * Smoke test the PyInstaller-built nasaq-engine binary.
 */
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const enginePath = isWindows
  ? path.join(root, "build", "nasaq-engine", "nasaq-engine.exe")
  : path.join(root, "build", "nasaq-engine", "nasaq-engine");

if (!fs.existsSync(enginePath)) {
  console.error(`Engine not built. Run: npm run build:python-engine`);
  process.exit(1);
}

const configPath = path.join(root, "build", "smoke-config.json");
const child = spawn(enginePath, [], {
  env: {
    ...process.env,
    NASAQ_CONFIG_PATH: configPath,
  },
  stdio: ["pipe", "pipe", "pipe"],
});

let stdout = "";
child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
});

child.stdin.write(`${JSON.stringify({ id: 1, method: "ping", params: {} })}\n`);

const timeout = setTimeout(() => {
  console.error("Engine smoke test timed out");
  child.kill();
  process.exit(1);
}, 10000);

child.on("exit", (code) => {
  clearTimeout(timeout);
  if (code !== 0) {
    console.error(`Engine exited with code ${code}`);
    process.exit(code ?? 1);
  }
});

setTimeout(() => {
  try {
    const line = stdout.trim().split("\n").find((l) => l.includes('"result"'));
    if (!line) {
      console.error("No RPC response:", stdout);
      process.exit(1);
    }
    const response = JSON.parse(line);
    if (response.result?.ok !== true) {
      console.error("Unexpected ping response:", response);
      process.exit(1);
    }
    console.log("Engine smoke test passed");
    child.kill();
    process.exit(0);
  } catch (error) {
    console.error(error);
    child.kill();
    process.exit(1);
  }
}, 2000);
