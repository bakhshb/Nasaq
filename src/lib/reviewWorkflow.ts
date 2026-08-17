import { getProposedFullName } from "./buildProposedName";
import { filenamesMatch } from "./fileStatus";
import type { ReviewRow, ReviewStatus } from "../types";

export type ReviewFilter = "all" | "pending" | "ready" | "complete";

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: "للمراجعة",
  ready: "جاهز للتطبيق",
  complete: "مكتمل",
};

export function getDraftProposedFullName(row: ReviewRow, separator = " - "): string {
  return getProposedFullName(row.topic, row.documentType, row.versionStatus, row.extension, separator);
}

export function getAcceptedProposedFullName(row: ReviewRow, separator = " - "): string {
  if (row.reviewStatus === "pending") {
    return "";
  }
  return getProposedFullName(
    row.acceptedTopic,
    row.acceptedDocumentType,
    row.acceptedVersionStatus,
    row.extension,
    separator,
  );
}

export function getDisplayProposedFullName(row: ReviewRow, separator = " - "): string {
  if (row.reviewStatus === "pending") {
    return getDraftProposedFullName(row, separator);
  }
  return getAcceptedProposedFullName(row, separator);
}

export function draftMatchesDisk(row: ReviewRow, separator = " - "): boolean {
  const draft = getDraftProposedFullName(row, separator);
  return draft !== "" && filenamesMatch(row.currentFullName, draft);
}

export function acceptReviewRow(row: ReviewRow, separator = " - "): ReviewRow {
  const acceptedTopic = row.topic.trim();
  const acceptedDocumentType = row.documentType.trim();
  const acceptedVersionStatus = row.versionStatus.trim();
  const acceptedFullName = getProposedFullName(
    acceptedTopic,
    acceptedDocumentType,
    acceptedVersionStatus,
    row.extension,
    separator,
  );

  const matchesDisk = filenamesMatch(row.currentFullName, acceptedFullName);

  return {
    ...row,
    acceptedTopic,
    acceptedDocumentType,
    acceptedVersionStatus,
    reviewStatus: matchesDisk ? "complete" : "ready",
    selected: !matchesDisk,
    applyError: undefined,
  };
}

export function markRowPendingAfterEdit(row: ReviewRow, patch: Partial<ReviewRow>): ReviewRow {
  const updated = { ...row, ...patch };
  const fieldEdited =
    patch.topic !== undefined ||
    patch.documentType !== undefined ||
    patch.versionStatus !== undefined;

  if (!fieldEdited || updated.reviewStatus === "pending") {
    return updated;
  }

  return {
    ...updated,
    reviewStatus: "pending",
    acceptedTopic: "",
    acceptedDocumentType: "",
    acceptedVersionStatus: "",
    selected: false,
    applyError: undefined,
  };
}

export function canSelectRow(row: ReviewRow): boolean {
  return row.reviewStatus === "pending" || row.reviewStatus === "ready";
}

export function countByReviewStatus(rows: ReviewRow[]): Record<ReviewStatus, number> {
  return rows.reduce(
    (counts, row) => {
      counts[row.reviewStatus] += 1;
      return counts;
    },
    { pending: 0, ready: 0, complete: 0 },
  );
}

/** Only explicitly approved rows can be applied. */
export function canApplyRow(row: ReviewRow): boolean {
  return row.reviewStatus === "ready";
}

export interface RenameBatchItem {
  id: string;
  reviewId: string;
  absolutePath: string;
  proposedFullName: string;
  topic: string;
  documentType: string;
  versionStatus: string;
  relativePath: string;
}

export function buildRenameItemFromRow(row: ReviewRow, separator = " - "): RenameBatchItem | null {
  if (row.reviewStatus !== "ready") {
    return null;
  }

  const proposedFullName = getAcceptedProposedFullName(row, separator);
  if (!proposedFullName) {
    return null;
  }

  return {
    id: row.id,
    reviewId: row.reviewId,
    absolutePath: row.absolutePath,
    proposedFullName,
    topic: row.acceptedTopic,
    documentType: row.acceptedDocumentType,
    versionStatus: row.acceptedVersionStatus,
    relativePath: row.relativePath,
  };
}

export function proposedStemFromFullName(row: ReviewRow, proposedFullName: string): string {
  const extension = row.extension;
  if (extension && proposedFullName.endsWith(extension)) {
    return proposedFullName.slice(0, proposedFullName.length - extension.length);
  }
  const dotIndex = proposedFullName.lastIndexOf(".");
  if (dotIndex > 0) {
    return proposedFullName.slice(0, dotIndex);
  }
  return proposedFullName;
}

export function toReviewApprovalPayload(row: ReviewRow, separator = " - "): {
  reviewId: string;
  absolutePath: string;
  knownAbsolutePaths: string[];
  topic: string;
  documentType: string;
  versionStatus: string;
  acceptedFullName: string;
} {
  return {
    reviewId: row.reviewId,
    absolutePath: row.absolutePath,
    knownAbsolutePaths: row.knownAbsolutePaths,
    topic: row.acceptedTopic,
    documentType: row.acceptedDocumentType,
    versionStatus: row.acceptedVersionStatus,
    acceptedFullName: getAcceptedProposedFullName(row, separator),
  };
}
