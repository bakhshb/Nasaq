import fs from "fs";
import path from "path";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";

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
import { getAppRoot, getConfigEnvPath } from "./platform/paths";

const python = new PythonBridge();
let undoStack: RenameBatch[] = [];
const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

function logStartup(message: string): void {
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const line = `${new Date().toISOString()} ${message}\n`;
    fs.appendFileSync(path.join(logDir, "startup.log"), line, "utf8");
  } catch {
    // ignore logging failures
  }
}

function resolvePreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function resolveIndexHtmlPath(): string {
  return path.join(getAppRoot(), "dist", "index.html");
}

function registerIpcHandlers(): void {
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
}

function createWindow(): void {
  const preloadPath = resolvePreloadPath();
  const indexPath = resolveIndexHtmlPath();

  logStartup(`createWindow preload=${preloadPath} index=${indexPath}`);
  logStartup(`preload exists=${fs.existsSync(preloadPath)} index exists=${fs.existsSync(indexPath)}`);

  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: isDev,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
  });

  if (isDev) {
    window.loadURL("http://localhost:5173");
    window.webContents.openDevTools({ mode: "detach" });
  } else {
    window.loadFile(indexPath);
  }

  window.webContents.on("did-finish-load", () => {
    logStartup("did-finish-load");
  });

  window.webContents.on("did-fail-load", (_event, code, description, url) => {
    const message = `did-fail-load code=${code} desc=${description} url=${url}`;
    console.error(message);
    logStartup(message);
  });

  window.webContents.on("preload-error", (_event, preloadPathArg, error) => {
    const message = `preload-error path=${preloadPathArg} err=${error.message}`;
    console.error(message);
    logStartup(message);
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
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createWindow();

  python.start().catch((error) => {
    console.error("Failed to start Python sidecar:", error);
    logStartup(`python start failed: ${String(error)}`);
  });

  if (app.isPackaged) {
    initAutoUpdater(true);
  }

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
