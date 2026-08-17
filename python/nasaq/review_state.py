"""Apply persisted ready approvals to scanned review rows."""

from __future__ import annotations

from nasaq.approved_names import filenames_match
from nasaq.review_approvals import ReviewApprovalEntry, ReviewApprovalsStore


def apply_persisted_approvals(
    store: ReviewApprovalsStore,
    root_path: str,
    rows: list[dict],
) -> list[dict]:
    """Merge persisted ready approvals into scan rows by reviewId or known absolute path."""
    approvals = store.list_for_root(root_path)
    if not approvals:
        return rows

    by_review_id = {entry.review_id: entry for entry in approvals}
    by_path: dict[str, ReviewApprovalEntry] = {}
    for entry in approvals:
        for path in entry.absolute_paths:
            by_path[_normalize_path_key(path)] = entry

    updated: list[dict] = []
    for row in rows:
        review_id = str(row.get("reviewId", "")).strip()
        absolute_path = str(row.get("absolutePath", ""))
        entry = by_review_id.get(review_id) if review_id else None
        if not entry and absolute_path:
            entry = by_path.get(_normalize_path_key(absolute_path))

        if not entry:
            updated.append(row)
            continue

        current_full_name = str(row.get("currentName", "")) + str(row.get("extension", ""))
        accepted_full_name = entry.accepted_full_name
        matches_disk = filenames_match(current_full_name, accepted_full_name)

        known_paths = list(entry.absolute_paths)
        if absolute_path and _normalize_path_key(absolute_path) not in {
            _normalize_path_key(path) for path in known_paths
        }:
            known_paths.append(absolute_path)

        if matches_disk:
            store.remove(entry.review_id)

        merged = {
            **row,
            "reviewId": entry.review_id,
            "knownAbsolutePaths": known_paths,
            "topic": entry.topic,
            "documentType": entry.document_type,
            "versionStatus": entry.version_status,
            "acceptedTopic": entry.topic,
            "acceptedDocumentType": entry.document_type,
            "acceptedVersionStatus": entry.version_status,
            "reviewStatus": "complete" if matches_disk else "ready",
            "selected": False,
        }
        updated.append(merged)

    return updated


def _normalize_path_key(path: str) -> str:
    return str(path).replace("\\", "/").strip().lower()
