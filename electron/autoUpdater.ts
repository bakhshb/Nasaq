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
let downloadInProgress = false;
let pendingUpdateVersion: string | undefined;

export function setUpdateWindow(window: BrowserWindow): void {
  mainWindow = window;
}

function emit(status: UpdateStatus): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update-status", status);
  }
}

async function startAutoDownload(version: string): Promise<void> {
  if (downloadInProgress) {
    return;
  }

  downloadInProgress = true;
  emit({ phase: "downloading", version, percent: 0 });

  try {
    await autoUpdater.downloadUpdate();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit({ phase: "error", message });
  } finally {
    downloadInProgress = false;
  }
}

export function initAutoUpdater(isPackaged: boolean): void {
  packagedApp = isPackaged;
  if (!isPackaged) {
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  // Full installer download when skipping versions (e.g. 0.1.20 -> 0.1.22).
  autoUpdater.disableDifferentialDownload = true;

  autoUpdater.on("checking-for-update", () => {
    emit({ phase: "checking" });
  });

  autoUpdater.on("update-available", (info) => {
    pendingUpdateVersion = info.version;
    emit({ phase: "available", version: info.version });
    void startAutoDownload(info.version);
  });

  autoUpdater.on("update-not-available", () => {
    emit({ phase: "not-available", version: app.getVersion() });
  });

  autoUpdater.on("download-progress", (progress) => {
    emit({ phase: "downloading", version: pendingUpdateVersion, percent: progress.percent });
  });

  autoUpdater.on("update-downloaded", (info) => {
    pendingUpdateVersion = undefined;
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
  if (pendingUpdateVersion) {
    await startAutoDownload(pendingUpdateVersion);
    return;
  }

  const result = await autoUpdater.checkForUpdates();
  if (result?.isUpdateAvailable && result.updateInfo.version) {
    await startAutoDownload(result.updateInfo.version);
  }
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true);
}
