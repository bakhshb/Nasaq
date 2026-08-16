import { app } from "electron";
import fs from "fs";
import path from "path";

/** Compiled output lives in dist-electron/; this file is in dist-electron/platform/. */
function getElectronRoot(): string {
  return path.join(__dirname, "..");
}

export function getAppRoot(): string {
  if (app.isPackaged) {
    return app.getAppPath();
  }
  return path.resolve(getElectronRoot(), "..");
}

export function getUserDataPath(): string {
  return app.getPath("userData");
}

export function getConfigEnvPath(): string {
  return path.join(getUserDataPath(), "config.json");
}

export function getApprovedNamesEnvPath(): string {
  return path.join(getUserDataPath(), "approved-names.json");
}

export function getPythonSpawnOptions(): { command: string; args: string[]; env: Record<string, string> } {
  const env = { ...process.env } as Record<string, string>;
  env.NASAQ_CONFIG_PATH = getConfigEnvPath();
  env.NASAQ_APPROVED_NAMES_PATH = getApprovedNamesEnvPath();
  env.PYTHONUTF8 = "1";
  env.PYTHONIOENCODING = "utf-8";

  const bundledWin = path.join(process.resourcesPath, "nasaq-engine", "nasaq-engine.exe");
  const bundledUnix = path.join(process.resourcesPath, "nasaq-engine", "nasaq-engine");

  if (fs.existsSync(bundledWin)) {
    return { command: bundledWin, args: [], env };
  }
  if (fs.existsSync(bundledUnix)) {
    return { command: bundledUnix, args: [], env };
  }

  const repoRoot = getAppRoot();
  const devBundledWin = path.join(repoRoot, "build", "nasaq-engine", "nasaq-engine.exe");
  const devBundledUnix = path.join(repoRoot, "build", "nasaq-engine", "nasaq-engine");
  if (!app.isPackaged && fs.existsSync(devBundledUnix)) {
    return { command: devBundledUnix, args: [], env };
  }
  if (!app.isPackaged && fs.existsSync(devBundledWin)) {
    return { command: devBundledWin, args: [], env };
  }

  if (process.env.NASAQ_ENGINE_PATH && fs.existsSync(process.env.NASAQ_ENGINE_PATH)) {
    return { command: process.env.NASAQ_ENGINE_PATH, args: [], env };
  }

  if (process.env.NASAQ_PYTHON && fs.existsSync(process.env.NASAQ_PYTHON)) {
    return {
      command: process.env.NASAQ_PYTHON,
      args: ["-m", "nasaq"],
      env,
    };
  }

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
  return path.join(getElectronRoot(), "preload.js");
}

export function resolveIndexHtmlPath(): string {
  return path.join(getAppRoot(), "dist", "index.html");
}
