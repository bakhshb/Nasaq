import { app, BrowserWindow, dialog, ipcMain } from "electron";

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
  resolveIndexHtml,
  resolvePreloadPath,
} from "./platform/paths";

const python = new PythonBridge();
let undoStack: RenameBatch[] = [];
const isDev = !app.isPackaged;

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

  const index = resolveIndexHtml(isDev);
  if (index.startsWith("http")) {
    window.loadURL(index);
    if (isDev) {
      window.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    window.loadFile(index);
  }
}

app.whenReady().then(async () => {
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
