import { getProposedFullName } from "./buildProposedName";

export type FileRenameStatus = "organized" | "needs_rename";

function normalizeFilename(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

export function getFileRenameStatus(
  currentFullName: string,
  topic: string,
  documentType: string,
  versionStatus: string,
  extension: string,
  separator: string,
): FileRenameStatus {
  const proposed = getProposedFullName(topic, documentType, versionStatus, extension, separator);
  if (!proposed.trim()) {
    return "needs_rename";
  }
  return normalizeFilename(currentFullName) === normalizeFilename(proposed)
    ? "organized"
    : "needs_rename";
}

export type FileFilter = "all" | "remaining" | "organized";
