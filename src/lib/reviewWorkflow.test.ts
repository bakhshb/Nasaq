import { describe, expect, it } from "vitest";

import {
  acceptReviewRow,
  buildRenameItemFromRow,
  canApplyRow,
  draftMatchesDisk,
  markRowPendingAfterEdit,
} from "./reviewWorkflow";
import type { ReviewRow } from "../types";

const SEPARATOR = " - ";

function makeRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  return {
    id: "file-id-1",
    reviewId: "review-1",
    absolutePath: "/work/report.pdf",
    knownAbsolutePaths: ["/work/report.pdf"],
    relativePath: "report.pdf",
    extension: ".pdf",
    currentName: "report",
    currentFullName: "report.pdf",
    documentType: "تقرير",
    topic: "مشروع أ",
    versionStatus: "نهائي",
    reviewStatus: "pending",
    acceptedTopic: "",
    acceptedDocumentType: "",
    acceptedVersionStatus: "",
    scannedProposedFullName: "مشروع أ",
    scannedTopic: "مشروع أ",
    scannedDocumentType: "تقرير",
    scannedVersionStatus: "نهائي",
    selected: false,
    warnings: [],
    ...overrides,
  };
}

describe("reviewWorkflow", () => {
  it("transitions pending to ready on approve when disk name differs", () => {
    const row = makeRow();
    const accepted = acceptReviewRow(row, SEPARATOR);
    expect(accepted.reviewStatus).toBe("ready");
    expect(accepted.acceptedTopic).toBe("مشروع أ");
    expect(accepted.selected).toBe(true);
  });

  it("transitions pending with matching disk name to complete", () => {
    const row = makeRow({
      currentName: "مشروع أ - تقرير - نهائي",
      currentFullName: "مشروع أ - تقرير - نهائي.pdf",
    });
    expect(draftMatchesDisk(row, SEPARATOR)).toBe(true);
    const accepted = acceptReviewRow(row, SEPARATOR);
    expect(accepted.reviewStatus).toBe("complete");
    expect(accepted.selected).toBe(false);
  });

  it("does not allow applying pending rows", () => {
    expect(canApplyRow(makeRow())).toBe(false);
    expect(buildRenameItemFromRow(makeRow(), SEPARATOR)).toBeNull();
  });

  it("allows applying ready rows using accepted fields only", () => {
    const row = makeRow({
      reviewStatus: "ready",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
      topic: "draft topic",
    });
    expect(canApplyRow(row)).toBe(true);
    const item = buildRenameItemFromRow(row, SEPARATOR);
    expect(item?.proposedFullName).toBe("مشروع أ - تقرير - نهائي.pdf");
  });

  it("returns ready row to pending when edited", () => {
    const row = makeRow({
      reviewStatus: "ready",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
    });
    const updated = markRowPendingAfterEdit(row, { topic: "مشروع ب" });
    expect(updated.reviewStatus).toBe("pending");
    expect(updated.acceptedTopic).toBe("");
  });

  it("returns complete row to pending when edited", () => {
    const row = makeRow({
      reviewStatus: "complete",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
      currentName: "مشروع أ - تقرير - نهائي",
      currentFullName: "مشروع أ - تقرير - نهائي.pdf",
    });
    const updated = markRowPendingAfterEdit(row, { documentType: "عرض" });
    expect(updated.reviewStatus).toBe("pending");
    expect(updated.acceptedDocumentType).toBe("");
  });
});
