import { describe, expect, it } from "vitest";

import { applySuccessfulRename, mergeRowsAfterScan } from "./mergeRowsAfterScan";
import { createReviewId } from "./reviewIdentity";
import type { ReviewRow } from "../types";

const SEPARATOR = " - ";

function makeRow(overrides: Partial<ReviewRow> = {}): ReviewRow {
  const absolutePath = overrides.absolutePath ?? "/work/old-name.pdf";
  return {
    id: "file-id-1",
    reviewId: overrides.reviewId ?? "review-1",
    absolutePath,
    knownAbsolutePaths: overrides.knownAbsolutePaths ?? [absolutePath],
    relativePath: overrides.relativePath ?? "old-name.pdf",
    extension: ".pdf",
    currentName: overrides.currentName ?? "old-name",
    currentFullName: overrides.currentFullName ?? "old-name.pdf",
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

describe("mergeRowsAfterScan", () => {
  it("promotes ready to complete after successful apply and rescan via path alias", () => {
    const prior = makeRow({
      reviewStatus: "ready",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
      topic: "مشروع أ",
      knownAbsolutePaths: ["/work/old-name.pdf", "/work/مشروع أ - تقرير - نهائي.pdf"],
      absolutePath: "/work/مشروع أ - تقرير - نهائي.pdf",
    });

    const scanned = makeRow({
      id: "new-file-id",
      absolutePath: "/work/مشروع أ - تقرير - نهائي.pdf",
      knownAbsolutePaths: ["/work/مشروع أ - تقرير - نهائي.pdf"],
      relativePath: "مشروع أ - تقرير - نهائي.pdf",
      currentName: "مشروع أ - تقرير - نهائي",
      currentFullName: "مشروع أ - تقرير - نهائي.pdf",
      reviewStatus: "pending",
    });

    const merged = mergeRowsAfterScan([prior], [scanned], SEPARATOR);
    expect(merged[0].reviewStatus).toBe("complete");
    expect(merged[0].reviewId).toBe("review-1");
  });

  it("keeps failed apply rows ready with prior accepted fields", () => {
    const prior = makeRow({
      reviewStatus: "ready",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
      topic: "مشروع أ",
      applyError: "target locked",
      selected: true,
    });
    const scanned = makeRow({ reviewStatus: "pending" });
    const merged = mergeRowsAfterScan([prior], [scanned], SEPARATOR);
    expect(merged[0].reviewStatus).toBe("ready");
    expect(merged[0].applyError).toBe("target locked");
  });

  it("resets complete to pending when disk no longer matches accepted name", () => {
    const prior = makeRow({
      reviewStatus: "complete",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
      currentName: "مشروع أ - تقرير - نهائي",
      currentFullName: "مشروع أ - تقرير - نهائي.pdf",
    });
    const scanned = makeRow({
      currentName: "changed externally",
      currentFullName: "changed externally.pdf",
      reviewStatus: "pending",
    });
    const merged = mergeRowsAfterScan([prior], [scanned], SEPARATOR);
    expect(merged[0].reviewStatus).toBe("pending");
  });
});

describe("applySuccessfulRename", () => {
  it("tracks fromPath to toPath and marks row complete", () => {
    const row = makeRow({
      reviewStatus: "ready",
      acceptedTopic: "مشروع أ",
      acceptedDocumentType: "تقرير",
      acceptedVersionStatus: "نهائي",
      topic: "مشروع أ",
    });

    const updated = applySuccessfulRename(
      row,
      "/work/old-name.pdf",
      "/work/مشروع أ - تقرير - نهائي.pdf",
      "مشروع أ - تقرير - نهائي.pdf",
      SEPARATOR,
    );

    expect(updated.reviewStatus).toBe("complete");
    expect(updated.absolutePath).toBe("/work/مشروع أ - تقرير - نهائي.pdf");
    expect(updated.knownAbsolutePaths).toContain("/work/old-name.pdf");
    expect(updated.knownAbsolutePaths).toContain("/work/مشروع أ - تقرير - نهائي.pdf");
    expect(updated.reviewId).toBe("review-1");
  });

  it("assigns stable review ids for new rows", () => {
    const id = createReviewId();
    expect(id.length).toBeGreaterThan(8);
  });
});
