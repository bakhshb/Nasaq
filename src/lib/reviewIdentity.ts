import type { ReviewRow } from "../types";

/** Collect every absolute path this row has been known by (current + prior paths). */
export function getKnownAbsolutePaths(row: ReviewRow): string[] {
  const paths = new Set<string>();
  if (row.absolutePath) {
    paths.add(row.absolutePath);
  }
  for (const path of row.knownAbsolutePaths ?? []) {
    if (path) {
      paths.add(path);
    }
  }
  return [...paths];
}

export function createReviewId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withPathTransition(
  row: ReviewRow,
  fromPath: string,
  toPath: string,
): ReviewRow {
  const known = new Set(getKnownAbsolutePaths(row));
  known.add(fromPath);
  known.add(toPath);
  return {
    ...row,
    absolutePath: toPath,
    knownAbsolutePaths: [...known],
  };
}

export function indexRowsByIdentity(rows: ReviewRow[]): Map<string, ReviewRow> {
  const byReviewId = new Map<string, ReviewRow>();
  for (const row of rows) {
    byReviewId.set(row.reviewId, row);
  }
  return byReviewId;
}

export function indexRowsByKnownPaths(rows: ReviewRow[]): Map<string, ReviewRow> {
  const byPath = new Map<string, ReviewRow>();
  for (const row of rows) {
    for (const path of getKnownAbsolutePaths(row)) {
      byPath.set(normalizePathKey(path), row);
    }
  }
  return byPath;
}

export function normalizePathKey(path: string): string {
  return path.replace(/\\/g, "/").trim().toLowerCase();
}

export function findPriorRow(
  scanned: ReviewRow,
  byReviewId: Map<string, ReviewRow>,
  byPath: Map<string, ReviewRow>,
): ReviewRow | undefined {
  const byId = byReviewId.get(scanned.reviewId);
  if (byId) {
    return byId;
  }
  return byPath.get(normalizePathKey(scanned.absolutePath));
}
