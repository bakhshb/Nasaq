import type { ReviewRow } from "../types";

export type FileRenameStatus = "organized" | "needs_rename";

function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

export function hasPendingEdits(row: ReviewRow): boolean {
  return (
    row.topic !== row.scannedTopic ||
    row.documentType !== row.scannedDocumentType ||
    row.versionStatus !== row.scannedVersionStatus
  );
}

/**
 * Status never flips to "organized" from live field edits.
 * Organized only after a successful rename, or when the scan found the file
 * already correctly named and the user has not changed any fields.
 */
export function getFileRenameStatus(row: ReviewRow): FileRenameStatus {
  if (row.renameApplied) {
    return "organized";
  }

  if (hasPendingEdits(row)) {
    return "needs_rename";
  }

  if (!row.scannedProposedFullName.trim()) {
    return "needs_rename";
  }

  return normalizeFilename(row.currentFullName) === normalizeFilename(row.scannedProposedFullName)
    ? "organized"
    : "needs_rename";
}


export type FileFilter = "all" | "remaining" | "organized";
