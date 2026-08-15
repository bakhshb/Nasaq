import { app } from "electron";
import fs from "fs";
import path from "path";

export function getUserDataPath(): string {
  return app.getPath("userData");
}

export function getConfigEnvPath(): string {
  return path.join(getUserDataPath(), "config.json");
}

export function getPythonSpawnOptions(): { command: string; args: string[]; env: Record<string, string> } {
  const env = { ...process.env } as Record<string, string>;
  env.NASAQ_CONFIG_PATH = getConfigEnvPath();

  const bundledWin = path.join(process.resourcesPath, "nasaq-engine", "nasaq-engine.exe");
  const bundledUnix = path.join(process.resourcesPath, "nasaq-engine", "nasaq-engine");

  if (fs.existsSync(bundledWin)) {
    return { command: bundledWin, args: [], env };
  }
  if (fs.existsSync(bundledUnix)) {
    return { command: bundledUnix, args: [], env };
  }

  if (process.env.NASAQ_PYTHON && fs.existsSync(process.env.NASAQ_PYTHON)) {
    return {
      command: process.env.NASAQ_PYTHON,
      args: ["-m", "nasaq"],
      env,
    };
  }

  const repoRoot = path.resolve(__dirname, "..");
  env.PYTHONPATH = path.join(repoRoot, "python");
  const venvCandidates = [
    path.join(repoRoot, "python", ".venv", "bin", "python"),
    path.join(repoRoot, "python", ".venv", "bin", "python3"),
    path.join(repoRoot, "python", ".venv", "Scripts", "python.exe"),
  ];

  for (const candidate of venvCandidates) {
    if (fs.existsSync(candidate)) {
      return { command: candidate, args: ["-m", "nasaq"], env };
    }
  }

  const fallback = process.platform === "win32" ? "python" : "python3";
  return { command: fallback, args: ["-m", "nasaq"], env };
}

export function resolvePreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

export function resolveIndexHtml(isDev: boolean): string {
  if (isDev) {
    return "http://localhost:5173";
  }
  return path.join(__dirname, "../dist/index.html");
}
