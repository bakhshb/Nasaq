export type FileRenameStatus = "organized" | "needs_rename";

function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

/** Status is based on the filename on disk vs the scan result — not live field edits. */
export function getFileRenameStatus(
  currentFullName: string,
  scannedProposedFullName: string,
): FileRenameStatus {
  if (!scannedProposedFullName.trim()) {
    return "needs_rename";
  }
  return normalizeFilename(currentFullName) === normalizeFilename(scannedProposedFullName)
    ? "organized"
    : "needs_rename";
}

export type FileFilter = "all" | "remaining" | "organized";
