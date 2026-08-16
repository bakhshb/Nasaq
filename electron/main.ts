import { app, BrowserWindow, dialog, ipcMain } from "electron";

import {
  checkForUpdates,
  downloadUpdate,
  initAutoUpdater,
  installUpdate,
  setUpdateWindow,
} from "./autoUpdater";
import { PythonBridge } from "./pythonBridge";
import {
  applyRenames,
  buildTargetPath,
  RenameBatch,
  RenameMove,
  undoRenames,
} from "./rename";
import {
  getConfigEnvPath,
  resolvePreloadPath,
  resolveWindowUrl,
} from "./platform/paths";
import { registerAppProtocol, registerPrivilegedSchemes } from "./protocol";

const python = new PythonBridge();
let undoStack: RenameBatch[] = [];
const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

registerPrivilegedSchemes();

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const url = resolveWindowUrl(isDev);
  window.loadURL(url);
  if (isDev) {
    window.webContents.openDevTools({ mode: "detach" });
  }

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    console.error("Window failed to load:", code, description, url);
  });

  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error("Preload failed:", preloadPath, error);
  });

  mainWindow = window;
  setUpdateWindow(window);

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    registerAppProtocol();
  }

  try {
    await python.start();
  } catch (error) {
    console.error("Failed to start Python sidecar:", error);
  }

  ipcMain.handle("nasaq:ping", () => python.call("ping", {}));
  ipcMain.handle("nasaq:getConfig", () => python.call("get_config", {}));
  ipcMain.handle("nasaq:updateConfig", (_event, partial: Record<string, unknown>) =>
    python.call("update_config", partial),
  );
  ipcMain.handle(
    "nasaq:scanAndAnalyze",
    (_event, params: { rootPath: string; recursive?: boolean }) =>
      python.call("scan_and_analyze", params),
  );
  ipcMain.handle("nasaq:validateBatch", (_event, params: Record<string, unknown>) =>
    python.call("validate_batch", params),
  );

  ipcMain.handle("dialog:selectFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle(
    "fs:renameBatch",
    async (
      _event,
      payload: {
        rootPath: string;
        items: Array<{ id: string; absolutePath: string; proposedFullName: string }>;
      },
    ) => {
      const moves: RenameMove[] = payload.items.map((item) => ({
        fromPath: item.absolutePath,
        toPath: buildTargetPath(item.absolutePath, item.proposedFullName),
      }));

      await applyRenames(moves);

      const batch: RenameBatch = {
        id: `batch-${Date.now()}`,
        timestamp: new Date().toISOString(),
        moves,
      };
      undoStack.push(batch);

      return { batchId: batch.id, count: moves.length };
    },
  );

  ipcMain.handle("fs:undoLastRename", async () => {
    const batch = undoStack.pop();
    if (!batch) {
      return { undone: false };
    }
    await undoRenames(batch.moves);
    return { undone: true, count: batch.moves.length, batchId: batch.id };
  });

  ipcMain.handle("fs:canUndo", () => undoStack.length > 0);

  ipcMain.handle("app:getPaths", () => ({
    userData: app.getPath("userData"),
    configPath: getConfigEnvPath(),
  }));

  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:checkForUpdates", () => checkForUpdates());
  ipcMain.handle("app:downloadUpdate", () => downloadUpdate());
  ipcMain.handle("app:installUpdate", () => installUpdate());

  initAutoUpdater(app.isPackaged);
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  python.stop();
  if (process.platform !== "darwin") {
    app.quit();
  }
});
