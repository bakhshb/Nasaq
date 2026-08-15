export interface AppConfig {
  documentTypes: string[];
  documentTypeAliases: Record<string, string>;
  versionStatusKeywords: string[];
  noiseWords: string[];
  scan: {
    recursive: boolean;
    extensions: string[];
  };
  naming: {
    separator: string;
    qualifierOptional: boolean;
  };
}

export interface AnalyzedFile {
  id: string;
  absolutePath: string;
  relativePath: string;
  extension: string;
  currentName: string;
  folderName: string;
  documentType: string;
  topic: string;
  versionStatus: string;
  proposedName: string;
  proposedFullName: string;
  confidence: {
    topic: number;
    document_type: number;
    version_status: number;
    overall: number;
  };
  warnings: string[];
}

export interface ReviewRow {
  id: string;
  absolutePath: string;
  relativePath: string;
  extension: string;
  currentName: string;
  currentFullName: string;
  documentType: string;
  topic: string;
  versionStatus: string;
  selected: boolean;
  warnings: string[];
}

export interface ValidationIssue {
  fileId: string;
  code: string;
  message: string;
}

declare global {
  interface Window {
    nasaq: {
      ping: () => Promise<{ ok: boolean }>;
      getConfig: () => Promise<AppConfig>;
      updateConfig: (partial: Partial<AppConfig>) => Promise<AppConfig>;
      scanAndAnalyze: (params: { rootPath: string; recursive?: boolean }) => Promise<{
        files: AnalyzedFile[];
      }>;
      validateBatch: (params: {
        rootPath: string;
        proposals: Array<{
          fileId: string;
          proposedName: string;
          proposedFullName: string;
        }>;
        existingPaths: Record<string, string>;
      }) => Promise<{ issues: ValidationIssue[] }>;
      selectFolder: () => Promise<string | null>;
      renameBatch: (payload: {
        rootPath: string;
        items: Array<{ id: string; absolutePath: string; proposedFullName: string }>;
      }) => Promise<{ batchId: string; count: number }>;
      undoLastRename: () => Promise<{ undone: boolean; count?: number }>;
      canUndo: () => Promise<boolean>;
      getPaths: () => Promise<{ userData: string; configPath: string }>;
    };
  }
}
