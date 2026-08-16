import { getProposedFullName } from "./buildProposedName";
import type { ReviewRow } from "../types";
import { filenamesMatch, hasPendingEdits } from "./fileStatus";

/**
 * Preserve user edits and selection when refreshing scan results for the same files.
 * After a successful rename, keep fresh scan values instead of stale field edits.
 */
export function mergeRowsAfterScan(
  previous: ReviewRow[],
  scanned: ReviewRow[],
  separator: string,
): ReviewRow[] {
  const byAbsolutePath = new Map(previous.map((row) => [row.absolutePath, row]));

  return scanned.map((row) => {
    const prior = byAbsolutePath.get(row.absolutePath);
    if (!prior) {
      return row;
    }

    const priorProposed = getProposedFullName(
      prior.topic,
      prior.documentType,
      prior.versionStatus,
      prior.extension,
      separator,
    );

    if (filenamesMatch(row.currentFullName, priorProposed)) {
      const approvedFullName = getProposedFullName(
        prior.topic,
        prior.documentType,
        prior.versionStatus,
        prior.extension,
        separator,
      );
      return {
        ...row,
        topic: prior.topic,
        documentType: prior.documentType,
        versionStatus: prior.versionStatus,
        scannedTopic: prior.topic,
        scannedDocumentType: prior.documentType,
        scannedVersionStatus: prior.versionStatus,
        scannedProposedFullName: approvedFullName,
        selected: false,
      };
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
