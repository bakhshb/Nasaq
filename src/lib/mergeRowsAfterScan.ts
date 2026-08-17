import type { ReviewRow } from "../types";
import { filenamesMatch } from "./fileStatus";
import {
  findPriorRow,
  getKnownAbsolutePaths,
  indexRowsByIdentity,
  indexRowsByKnownPaths,
  withPathTransition,
} from "./reviewIdentity";
import { getAcceptedProposedFullName } from "./reviewWorkflow";

/**
 * Preserve review decisions and field edits when refreshing scan results.
 * Matches prior rows by stable reviewId and known absolute path aliases.
 */
export function mergeRowsAfterScan(
  previous: ReviewRow[],
  scanned: ReviewRow[],
  separator: string,
): ReviewRow[] {
  const byReviewId = indexRowsByIdentity(previous);
  const byPath = indexRowsByKnownPaths(previous);

  return scanned.map((row) => {
    const prior = findPriorRow(row, byReviewId, byPath);
    if (!prior) {
      return row;
    }

    const mergedBase: ReviewRow = {
      ...row,
      reviewId: prior.reviewId,
      knownAbsolutePaths: [...new Set([...getKnownAbsolutePaths(prior), row.absolutePath])],
      selected: prior.selected,
    };

    if (prior.reviewStatus === "pending") {
      if (!hasPriorFieldEdits(prior)) {
        return mergedBase;
      }
      return {
        ...mergedBase,
        topic: prior.topic,
        documentType: prior.documentType,
        versionStatus: prior.versionStatus,
      };
    }

    const acceptedFullName = getAcceptedProposedFullName(prior, separator);
    const diskMatchesAccepted = filenamesMatch(row.currentFullName, acceptedFullName);

    if (prior.reviewStatus === "ready") {
      if (diskMatchesAccepted) {
        return {
          ...mergedBase,
          topic: prior.acceptedTopic,
          documentType: prior.acceptedDocumentType,
          versionStatus: prior.acceptedVersionStatus,
          acceptedTopic: prior.acceptedTopic,
          acceptedDocumentType: prior.acceptedDocumentType,
          acceptedVersionStatus: prior.acceptedVersionStatus,
          reviewStatus: "complete",
          selected: false,
          applyError: undefined,
        };
      }

      return {
        ...mergedBase,
        topic: prior.acceptedTopic,
        documentType: prior.acceptedDocumentType,
        versionStatus: prior.acceptedVersionStatus,
        acceptedTopic: prior.acceptedTopic,
        acceptedDocumentType: prior.acceptedDocumentType,
        acceptedVersionStatus: prior.acceptedVersionStatus,
        reviewStatus: "ready",
        selected: prior.selected,
        applyError: prior.applyError,
      };
    }

    if (prior.reviewStatus === "complete") {
      if (diskMatchesAccepted) {
        return {
          ...mergedBase,
          topic: prior.acceptedTopic,
          documentType: prior.acceptedDocumentType,
          versionStatus: prior.acceptedVersionStatus,
          acceptedTopic: prior.acceptedTopic,
          acceptedDocumentType: prior.acceptedDocumentType,
          acceptedVersionStatus: prior.acceptedVersionStatus,
          reviewStatus: "complete",
          selected: false,
          applyError: undefined,
        };
      }

      return {
        ...mergedBase,
        reviewStatus: "pending",
        acceptedTopic: "",
        acceptedDocumentType: "",
        acceptedVersionStatus: "",
        selected: false,
        applyError: undefined,
      };
    }

    return mergedBase;
  });
}

/** Update a row after a successful on-disk rename. */
export function applySuccessfulRename(
  row: ReviewRow,
  fromPath: string,
  toPath: string,
  proposedFullName: string,
  separator: string,
): ReviewRow {
  const transitioned = withPathTransition(row, fromPath, toPath);
  const stem = proposedFullName.endsWith(transitioned.extension)
    ? proposedFullName.slice(0, proposedFullName.length - transitioned.extension.length)
    : proposedFullName;

  const parentSep = Math.max(
    transitioned.relativePath.lastIndexOf("/"),
    transitioned.relativePath.lastIndexOf("\\"),
  );
  const relativePath =
    parentSep >= 0
      ? `${transitioned.relativePath.slice(0, parentSep + 1)}${proposedFullName}`
      : proposedFullName;

  return {
    ...transitioned,
    id: row.id,
    relativePath,
    currentName: stem,
    currentFullName: proposedFullName,
    topic: row.acceptedTopic,
    documentType: row.acceptedDocumentType,
    versionStatus: row.acceptedVersionStatus,
    reviewStatus: "complete",
    selected: false,
    applyError: undefined,
  };
}

function hasPriorFieldEdits(row: ReviewRow): boolean {
  return (
    row.topic !== row.scannedTopic ||
    row.documentType !== row.scannedDocumentType ||
    row.versionStatus !== row.scannedVersionStatus
  );
}
