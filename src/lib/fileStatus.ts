import type { ReviewRow } from "../types";

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
