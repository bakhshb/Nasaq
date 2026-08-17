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
  createdAt?: string;
  createdAtIsBirthtime?: boolean;
  modifiedAt?: string;
}

export type ReviewStatus = "pending" | "ready" | "complete";

export interface ReviewRow {
  id: string;
  /** Stable identity across renames; persisted with ready approvals. */
  reviewId: string;
  absolutePath: string;
  /** Prior absolute paths after successful renames (for merge/rescan). */
  knownAbsolutePaths: string[];
  relativePath: string;
  extension: string;
  currentName: string;
  currentFullName: string;
  documentType: string;
  topic: string;
  versionStatus: string;
  reviewStatus: ReviewStatus;
  acceptedTopic: string;
  acceptedDocumentType: string;
  acceptedVersionStatus: string;
  scannedProposedFullName: string;
  scannedTopic: string;
  scannedDocumentType: string;
  scannedVersionStatus: string;
  selected: boolean;
  warnings: string[];
  /** Last rename failure message when status is ready. */
  applyError?: string;
  createdAt?: string;
  createdAtIsBirthtime?: boolean;
  modifiedAt?: string;
}

export interface ReviewApprovalPayload {
  reviewId: string;
  absolutePath: string;
  knownAbsolutePaths: string[];
  topic: string;
  documentType: string;
  versionStatus: string;
  acceptedFullName: string;
}

export interface RenameBatchResultItem {
  id: string;
  fromPath: string;
  toPath: string;
  success: boolean;
  error?: string;
}

export interface ValidationIssue {
  fileId: string;
  code: string;
  message: string;
}

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
      saveReviewApproval: (payload: {
        rootPath: string;
        approval: ReviewApprovalPayload;
      }) => Promise<{ saved: boolean }>;
      removeReviewApproval: (payload: { reviewId: string }) => Promise<{ removed: boolean }>;
      renameBatch: (payload: {
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
      }) => Promise<{ batchId: string; count: number; results: RenameBatchResultItem[] }>;
      undoLastRename: () => Promise<{ undone: boolean; count?: number }>;
      canUndo: () => Promise<boolean>;
      getPlatform: () => Promise<"win32" | "darwin" | "linux">;
      openFile: (absolutePath: string) => Promise<{ ok: boolean; error?: string }>;
      revealInFolder: (absolutePath: string) => Promise<{ ok: boolean; error?: string }>;
      getFileStats: (absolutePath: string) => Promise<{
        createdAt: string;
        modifiedAt: string;
        createdAtIsBirthtime: boolean;
      }>;
      getPaths: () => Promise<{ userData: string; configPath: string; approvedNamesPath: string; reviewApprovalsPath: string }>;
      saveReviewApproval: (payload: {
        rootPath: string;
        approval: ReviewApprovalPayload;
      }) => Promise<{ saved: boolean }>;
      removeReviewApproval: (payload: { reviewId: string }) => Promise<{ removed: boolean }>;
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<void>;
      downloadUpdate: () => Promise<void>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void;
      log: (message: string) => Promise<void>;
    };
  }
}
