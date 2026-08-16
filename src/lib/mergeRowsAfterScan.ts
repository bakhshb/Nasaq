import type { ReviewRow } from "../types";
import { hasPendingEdits } from "./fileStatus";

/**
 * Preserve user edits and selection when refreshing scan results for the same files.
 */
export function mergeRowsAfterScan(previous: ReviewRow[], scanned: ReviewRow[]): ReviewRow[] {
  const byAbsolutePath = new Map(previous.map((row) => [row.absolutePath, row]));
  const byRelativePath = new Map(previous.map((row) => [row.relativePath, row]));

  return scanned.map((row) => {
    const prior = byAbsolutePath.get(row.absolutePath) ?? byRelativePath.get(row.relativePath);
    if (!prior) {
      return row;
    }

    if (!hasPendingEdits(prior)) {
      return { ...row, selected: prior.selected };
    }

    return {
      ...row,
      topic: prior.topic,
      documentType: prior.documentType,
      versionStatus: prior.versionStatus,
      selected: prior.selected,
    };
  });
}
