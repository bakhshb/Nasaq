import fs from "fs";
import path from "path";

import { bootstrapLog } from "./bootstrapLog";
import { app, BrowserWindow, dialog, ipcMain, Menu } from "electron";

import {
  getFileStats,
  openFile,
  revealFileInFolder,
  type AppPlatform,
} from "./platform/fileActions";

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
  filterRenameMoves,
  prepareRenameMoves,
  RenameBatch,
  RenameError,
  RenameMove,
  undoRenames,
} from "./rename";
import { getConfigEnvPath, getApprovedNamesEnvPath, getReviewApprovalsEnvPath, getPythonSpawnOptions } from "./platform/paths";

bootstrapLog(`main.ts start pid=${process.pid} packaged=${String(app.isPackaged)}`);

const python = new PythonBridge();
let undoStack: RenameBatch[] = [];
const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

if (app.isPackaged) {
  app.setPath("userData", path.join(app.getPath("appData"), "Nasaq"));
}

function logStartup(message: string): void {
  bootstrapLog(message);
  try {
    const logDir = path.join(app.getPath("userData"), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "startup.log"), `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // ignore
  }
}

function resolvePreloadPath(): string {
  if (app.isPackaged) {
    const unpacked = path.join(process.resourcesPath, "app.asar.unpacked", "dist-electron", "preload.js");
    if (fs.existsSync(unpacked)) {
      return unpacked;
    }
  }
  return path.join(__dirname, "preload.js");
}

function resolveIndexHtmlPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "ui", "index.html");
  }
  return path.join(__dirname, "..", "dist", "index.html");
}

function showLoadError(window: BrowserWindow, details: string): void {
  const html = `
    <html><body style="font-family:Segoe UI;padding:24px">
      <h2>Nasaq failed to load the interface</h2>
      <pre style="white-space:pre-wrap">${details}</pre>
      <p>Log: %TEMP%\\Nasaq-startup.log</p>
    </body></html>`;
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

function registerIpcHandlers(): void {
  ipcMain.handle("app:log", (_event, message: string) => {
    logStartup(`renderer: ${message}`);
  });

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
  ipcMain.handle(
    "nasaq:saveReviewApproval",
    (_event, params: Record<string, unknown>) => python.call("save_review_approval", params),
  );
  ipcMain.handle(
    "nasaq:removeReviewApproval",
    (_event, params: Record<string, unknown>) => python.call("remove_review_approval", params),
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
        items: Array<{
          id: string;
          reviewId: string;
          absolutePath: string;
          proposedFullName: string;
          topic: string;
          documentType: string;
          versionStatus: string;
          relativePath: string;
        }>;
      },
    ) => {
      const batchId = `batch-${Date.now()}`;
      try {
        const moves = await prepareRenameMoves(payload.rootPath, payload.items);
        const actionableMoves = filterRenameMoves(moves);
        const moveResults = await applyRenames(moves);

        const successfulMoves: RenameMove[] = [];
        const responseResults: Array<{
          id: string;
          reviewId: string;
          fromPath: string;
          toPath: string;
          success: boolean;
          error?: string;
        }> = [];

        for (let index = 0; index < actionableMoves.length; index += 1) {
          const move = actionableMoves[index];
          const result = moveResults[index];
          const source =
            payload.items.find((item) => {
              const candidatePaths = [item.absolutePath, move.fromPath];
              return candidatePaths.some(
                (candidate) =>
                  path.resolve(candidate).toLowerCase() === path.resolve(move.fromPath).toLowerCase(),
              );
            }) ?? payload.items[index];

          if (result?.success) {
            successfulMoves.push(move);
          }

          responseResults.push({
            id: source?.id ?? payload.items[index]?.id ?? "",
            reviewId: source?.reviewId ?? payload.items[index]?.reviewId ?? "",
            fromPath: move.fromPath,
            toPath: move.toPath,
            success: Boolean(result?.success),
            error: result?.success ? undefined : result?.error,
          });
        }

        if (successfulMoves.length > 0) {
          const approvalItems = successfulMoves.map((move, index) => {
            const source =
              payload.items.find((item) => {
                const candidatePaths = [item.absolutePath, move.fromPath];
                return candidatePaths.some(
                  (candidate) =>
                    path.resolve(candidate).toLowerCase() === path.resolve(move.fromPath).toLowerCase(),
                );
              }) ?? payload.items[index];
            const relativePath = source?.relativePath ?? "";
            const updatedRelativePath =
              relativePath.includes(path.sep) || relativePath.includes("/")
                ? `${relativePath.slice(0, Math.max(relativePath.lastIndexOf("/"), relativePath.lastIndexOf("\\")) + 1)}${path.basename(move.toPath)}`
                : path.basename(move.toPath);

            return {
              fromPath: move.fromPath,
              toPath: move.toPath,
              reviewId: source?.reviewId ?? "",
              topic: source?.topic ?? "",
              documentType: source?.documentType ?? "",
              versionStatus: source?.versionStatus ?? "",
              proposedFullName: path.basename(move.toPath),
              relativePath: updatedRelativePath,
            };
          });

          await python.call("save_approved_names", {
            rootPath: payload.rootPath,
            items: approvalItems,
          });

          for (const item of approvalItems) {
            if (item.reviewId) {
              await python.call("remove_review_approval", { reviewId: item.reviewId });
            }
          }

          const batch: RenameBatch = {
            id: batchId,
            timestamp: new Date().toISOString(),
            moves: successfulMoves,
            approvalMoves: successfulMoves,
          };
          undoStack.push(batch);
        }

        return {
          batchId,
          count: successfulMoves.length,
          results: responseResults,
        };
      } catch (error) {
        if (error instanceof RenameError) {
          throw new Error(error.message);
        }
        throw error;
      }
    },
  );

  ipcMain.handle("fs:undoLastRename", async () => {
    const batch = undoStack.pop();
    if (!batch) {
      return { undone: false };
    }
    await undoRenames(batch.moves);
    if (batch.approvalMoves.length > 0) {
      await python.call("revert_approved_names", {
        moves: batch.approvalMoves.map((move) => ({
          fromPath: move.fromPath,
          toPath: move.toPath,
        })),
      });
    }
    return { undone: true, count: batch.moves.length, batchId: batch.id };
  });

  ipcMain.handle("fs:canUndo", () => undoStack.length > 0);

  ipcMain.handle("app:getPlatform", () => process.platform as AppPlatform);

  ipcMain.handle("fs:openFile", async (_event, absolutePath: string) =>
    openFile(absolutePath),
  );

  ipcMain.handle("fs:revealInFolder", async (_event, absolutePath: string) =>
    revealFileInFolder(absolutePath),
  );

  ipcMain.handle("fs:getFileStats", async (_event, absolutePath: string) =>
    getFileStats(absolutePath, process.platform as AppPlatform),
  );

  ipcMain.handle("app:getPaths", () => ({
    userData: app.getPath("userData"),
    configPath: getConfigEnvPath(),
    approvedNamesPath: getApprovedNamesEnvPath(),
    reviewApprovalsPath: getReviewApprovalsEnvPath(),
  }));

  ipcMain.handle("app:getVersion", () => app.getVersion());
  ipcMain.handle("app:checkForUpdates", () => checkForUpdates());
  ipcMain.handle("app:downloadUpdate", () => downloadUpdate());
  ipcMain.handle("app:installUpdate", () => installUpdate());
}

function attachRendererLogging(window: BrowserWindow): void {
  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    logStartup(`console[${level}] ${message} (${sourceId}:${line})`);
  });

  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      logStartup(
        `did-fail-load main=${isMainFrame} code=${errorCode} url=${validatedURL} desc=${errorDescription}`,
      );
    },
  );

  window.webContents.on("preload-error", (_event, preloadPathArg, error) => {
    logStartup(`preload-error path=${preloadPathArg} err=${error.message}`);
  });
}

function resolveIconPath(): string | undefined {
  const candidates = app.isPackaged
    ? [path.join(process.resourcesPath, "ui", "icon.png")]
    : [
        path.join(__dirname, "..", "installer", "icon.png"),
        path.join(__dirname, "..", "public", "icon.png"),
      ];

  for (const iconPath of candidates) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }
  return undefined;
}

function createWindow(): void {
  const preloadPath = resolvePreloadPath();
  const indexPath = resolveIndexHtmlPath();

  logStartup(`createWindow preload=${preloadPath}`);
  logStartup(`createWindow index=${indexPath}`);
  logStartup(`preload exists=${fs.existsSync(preloadPath)} index exists=${fs.existsSync(indexPath)}`);

  const assetsDir = path.join(path.dirname(indexPath), "assets");
  if (fs.existsSync(assetsDir)) {
    logStartup(`assets: ${fs.readdirSync(assetsDir).join(", ")}`);
  } else {
    logStartup(`assets dir missing: ${assetsDir}`);
  }

  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 600,
    show: false,
    icon: resolveIconPath(),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  attachRendererLogging(window);

  window.once("ready-to-show", () => {
    window.show();
  });

  if (isDev) {
    window.loadURL("http://localhost:5173");
    window.webContents.openDevTools({ mode: "detach" });
  } else if (!fs.existsSync(indexPath)) {
    showLoadError(window, `index.html not found:\n${indexPath}`);
  } else {
    window.loadFile(indexPath).catch((error: Error) => {
      showLoadError(window, `loadFile failed: ${error.message}`);
    });
  }

  window.webContents.on("did-finish-load", () => {
    logStartup(`did-finish-load url=${window.webContents.getURL()}`);
    window.webContents
      .executeJavaScript(
        `({
          scripts: Array.from(document.scripts).map(s => s.src),
          rootHtml: document.getElementById('root')?.innerHTML?.slice(0, 200),
          hasNasaq: typeof window.nasaq !== 'undefined'
        })`,
      )
      .then((snapshot) => {
        logStartup(`renderer snapshot: ${JSON.stringify(snapshot)}`);
      })
      .catch((error: Error) => {
        logStartup(`renderer snapshot failed: ${error.message}`);
      });
  });

  mainWindow = window;
  setUpdateWindow(window);

  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });
}

process.on("uncaughtException", (error) => {
  logStartup(`uncaughtException: ${error.stack || error.message}`);
});

process.on("unhandledRejection", (reason) => {
  logStartup(`unhandledRejection: ${String(reason)}`);
});

app.whenReady().then(async () => {
  logStartup("app ready");
  Menu.setApplicationMenu(null);
  registerIpcHandlers();
  createWindow();

  python.start().catch((error) => {
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
