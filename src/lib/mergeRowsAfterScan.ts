import type { ReviewRow } from "../types";
import { filenamesMatch } from "./fileStatus";
import { getAcceptedProposedFullName } from "./reviewWorkflow";

/**
 * Preserve review decisions and field edits when refreshing scan results.
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

    if (prior.reviewStatus === "pending") {
      if (!hasPriorFieldEdits(prior)) {
        return { ...row, selected: prior.selected };
      }
      return {
        ...row,
        topic: prior.topic,
        documentType: prior.documentType,
        versionStatus: prior.versionStatus,
        selected: prior.selected,
      };
    }

    const acceptedFullName = getAcceptedProposedFullName(prior, separator);
    const diskMatchesAccepted = filenamesMatch(row.currentFullName, acceptedFullName);

    if (prior.reviewStatus === "ready") {
      if (diskMatchesAccepted) {
        return {
          ...row,
          topic: prior.acceptedTopic,
          documentType: prior.acceptedDocumentType,
          versionStatus: prior.acceptedVersionStatus,
          acceptedTopic: prior.acceptedTopic,
          acceptedDocumentType: prior.acceptedDocumentType,
          acceptedVersionStatus: prior.acceptedVersionStatus,
          reviewStatus: "complete",
          selected: false,
        };
      }

      return {
        ...row,
        topic: prior.acceptedTopic,
        documentType: prior.acceptedDocumentType,
        versionStatus: prior.acceptedVersionStatus,
        acceptedTopic: prior.acceptedTopic,
        acceptedDocumentType: prior.acceptedDocumentType,
        acceptedVersionStatus: prior.acceptedVersionStatus,
        reviewStatus: "ready",
        selected: prior.selected,
      };
    }

    if (prior.reviewStatus === "complete") {
      if (diskMatchesAccepted) {
        return {
          ...row,
          topic: prior.acceptedTopic,
          documentType: prior.acceptedDocumentType,
          versionStatus: prior.acceptedVersionStatus,
          acceptedTopic: prior.acceptedTopic,
          acceptedDocumentType: prior.acceptedDocumentType,
          acceptedVersionStatus: prior.acceptedVersionStatus,
          reviewStatus: "complete",
          selected: false,
        };
      }

      return {
        ...row,
        reviewStatus: "pending",
        acceptedTopic: "",
        acceptedDocumentType: "",
        acceptedVersionStatus: "",
        selected: false,
      };
    }

    return row;
  });
}

function hasPriorFieldEdits(row: ReviewRow): boolean {
  return (
    row.topic !== row.scannedTopic ||
    row.documentType !== row.scannedDocumentType ||
    row.versionStatus !== row.scannedVersionStatus
  );
}
