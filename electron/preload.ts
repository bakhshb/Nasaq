import { contextBridge, ipcRenderer } from "electron";

export interface NasaqApi {
  ping: () => Promise<{ ok: boolean }>;
  getConfig: () => Promise<Record<string, unknown>>;
  updateConfig: (partial: Record<string, unknown>) => Promise<Record<string, unknown>>;
  scanAndAnalyze: (params: { rootPath: string; recursive?: boolean }) => Promise<{
    files: Array<Record<string, unknown>>;
  }>;
  validateBatch: (params: Record<string, unknown>) => Promise<{
    issues: Array<{ fileId: string; code: string; message: string }>;
  }>;
  selectFolder: () => Promise<string | null>;
  renameBatch: (payload: {
    rootPath: string;
    items: Array<{ id: string; absolutePath: string; proposedFullName: string }>;
  }) => Promise<{ batchId: string; count: number }>;
  undoLastRename: () => Promise<{ undone: boolean; count?: number; batchId?: string }>;
  canUndo: () => Promise<boolean>;
  getPaths: () => Promise<{ userData: string; configPath: string }>;
}

const api: NasaqApi = {
  ping: () => ipcRenderer.invoke("nasaq:ping") as Promise<{ ok: boolean }>,
  getConfig: () => ipcRenderer.invoke("nasaq:getConfig") as Promise<Record<string, unknown>>,
  updateConfig: (partial) =>
    ipcRenderer.invoke("nasaq:updateConfig", partial) as Promise<Record<string, unknown>>,
  scanAndAnalyze: (params) =>
    ipcRenderer.invoke("nasaq:scanAndAnalyze", params) as Promise<{
      files: Array<Record<string, unknown>>;
    }>,
  validateBatch: (params) =>
    ipcRenderer.invoke("nasaq:validateBatch", params) as Promise<{
      issues: Array<{ fileId: string; code: string; message: string }>;
    }>,
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder") as Promise<string | null>,
  renameBatch: (payload) =>
    ipcRenderer.invoke("fs:renameBatch", payload) as Promise<{ batchId: string; count: number }>,
  undoLastRename: () =>
    ipcRenderer.invoke("fs:undoLastRename") as Promise<{
      undone: boolean;
      count?: number;
      batchId?: string;
    }>,
  canUndo: () => ipcRenderer.invoke("fs:canUndo") as Promise<boolean>,
  getPaths: () =>
    ipcRenderer.invoke("app:getPaths") as Promise<{ userData: string; configPath: string }>,
};

contextBridge.exposeInMainWorld("nasaq", api);
