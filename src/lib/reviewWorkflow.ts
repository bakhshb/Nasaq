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
