import { getProposedFullName } from "./buildProposedName";
import type { ReviewRow } from "../types";

export type FileRenameStatus = "organized" | "needs_rename";

export function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

export function filenamesMatch(a: string, b: string): boolean {
  return normalizeFilename(a) === normalizeFilename(b);
}

export function hasPendingEdits(row: ReviewRow): boolean {
  return (
    row.topic !== row.scannedTopic ||
    row.documentType !== row.scannedDocumentType ||
    row.versionStatus !== row.scannedVersionStatus
  );
}

/**
 * Organized when the filename on disk matches the name built from the current
 * row fields (what the UI shows as the proposed name).
 */
export function getFileRenameStatus(row: ReviewRow, separator = " - "): FileRenameStatus {
  const liveProposed = getProposedFullName(
    row.topic,
    row.documentType,
    row.versionStatus,
    row.extension,
    separator,
  );

  if (!liveProposed.trim()) {
    return "needs_rename";
  }

  return filenamesMatch(row.currentFullName, liveProposed) ? "organized" : "needs_rename";
}

export type FileFilter = "all" | "remaining" | "organized";
