import { app, BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";

export type UpdatePhase =
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

export interface UpdateStatus {
  phase: UpdatePhase;
  version?: string;
  percent?: number;
  message?: string;
}

let mainWindow: BrowserWindow | null = null;
let packagedApp = false;

export function setUpdateWindow(window: BrowserWindow): void {
  mainWindow = window;
}

function emit(status: UpdateStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", status);
  }
}

export function initAutoUpdater(isPackaged: boolean): void {
  packagedApp = isPackaged;
  if (!isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("checking-for-update", () => {
    emit({ phase: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    emit({ phase: "available", version: info.version });
  });

  autoUpdater.on("update-not-available", () => {
    emit({ phase: "not-available", version: app.getVersion() });
  });

  autoUpdater.on("download-progress", (progress) => {
    emit({ phase: "downloading", percent: progress.percent });
  });

  autoUpdater.on("update-downloaded", (info) => {
    emit({ phase: "downloaded", version: info.version });
  });

  autoUpdater.on("error", (error) => {
    emit({ phase: "error", message: error.message });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Silent on startup — user can retry manually.
    });
  }, 4000);
}

export async function checkForUpdates(): Promise<void> {
  if (!packagedApp) {
    emit({
      phase: "not-available",
      version: app.getVersion(),
      message: "التحديثات التلقائية متاحة في النسخة المثبتة فقط.",
    });
    return;
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit({ phase: "error", message });
  }
}

export async function downloadUpdate(): Promise<void> {
  await autoUpdater.downloadUpdate();
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
