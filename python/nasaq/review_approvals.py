"""Persistent store for user-approved (ready) naming decisions before disk rename."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from nasaq.config import get_config_path


def get_review_approvals_path(explicit: Optional[str] = None) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    env_path = os.environ.get("NASAQ_REVIEW_APPROVALS_PATH")
    if env_path:
        return Path(env_path).expanduser()
    return get_config_path().parent / "review-approvals.json"


def _normalize_path_key(path: str) -> str:
    return str(Path(path).expanduser().resolve())


@dataclass
class ReviewApprovalEntry:
    review_id: str
    absolute_paths: list[str]
    topic: str
    document_type: str
    version_status: str
    accepted_full_name: str
    root_path: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict:
        return {
            "reviewId": self.review_id,
            "absolutePaths": list(self.absolute_paths),
            "topic": self.topic,
            "documentType": self.document_type,
            "versionStatus": self.version_status,
            "acceptedFullName": self.accepted_full_name,
            "rootPath": self.root_path,
            "updatedAt": self.updated_at,
        }

    @staticmethod
    def from_dict(data: dict) -> ReviewApprovalEntry:
        raw_paths = data.get("absolutePaths") or []
        if not isinstance(raw_paths, list):
            raw_paths = []
        return ReviewApprovalEntry(
            review_id=str(data.get("reviewId", "")),
            absolute_paths=[str(path) for path in raw_paths if str(path).strip()],
            topic=str(data.get("topic", "")),
            document_type=str(data.get("documentType", "")),
            version_status=str(data.get("versionStatus", "")),
            accepted_full_name=str(data.get("acceptedFullName", "")),
            root_path=str(data.get("rootPath", "")),
            updated_at=str(data.get("updatedAt", "")),
        )


class ReviewApprovalsStore:
    def __init__(self, path: Optional[str] = None) -> None:
        self._path = get_review_approvals_path(path)
        self._by_review_id: dict[str, ReviewApprovalEntry] = self._load()

    @property
    def path(self) -> Path:
        return self._path

    def list_for_root(self, root_path: str) -> list[ReviewApprovalEntry]:
        root_key = _normalize_path_key(root_path)
        return [
            entry
            for entry in self._by_review_id.values()
            if entry.root_path and _normalize_path_key(entry.root_path) == root_key
        ]

    def lookup_by_path(self, absolute_path: str) -> ReviewApprovalEntry | None:
        key = _normalize_path_key(absolute_path)
        for entry in self._by_review_id.values():
            normalized_paths = {_normalize_path_key(path) for path in entry.absolute_paths}
            if key in normalized_paths:
                return entry
        return None

    def save_ready(
        self,
        *,
        review_id: str,
        absolute_path: str,
        root_path: str,
        topic: str,
        document_type: str,
        version_status: str,
        accepted_full_name: str,
        known_absolute_paths: list[str] | None = None,
    ) -> None:
        if not review_id.strip():
            raise ValueError("review_id is required")

        now = datetime.now(timezone.utc).isoformat()
        existing = self._by_review_id.get(review_id)
        path_set: set[str] = set(known_absolute_paths or [])
        path_set.add(absolute_path)
        if existing:
            path_set.update(existing.absolute_paths)

        self._by_review_id[review_id] = ReviewApprovalEntry(
            review_id=review_id,
            absolute_paths=sorted(path_set, key=_normalize_path_key),
            topic=topic,
            document_type=document_type,
            version_status=version_status,
            accepted_full_name=accepted_full_name,
            root_path=root_path,
            updated_at=now,
        )
        self._save()

    def record_path_transition(
        self,
        review_id: str,
        from_path: str,
        to_path: str,
    ) -> None:
        entry = self._by_review_id.get(review_id)
        if not entry:
            return
        path_set = set(entry.absolute_paths)
        path_set.add(from_path)
        path_set.add(to_path)
        entry.absolute_paths = sorted(path_set, key=_normalize_path_key)
        entry.updated_at = datetime.now(timezone.utc).isoformat()
        self._save()

    def remove(self, review_id: str) -> bool:
        if review_id not in self._by_review_id:
            return False
        del self._by_review_id[review_id]
        self._save()
        return True

    def remove_by_path(self, absolute_path: str) -> bool:
        entry = self.lookup_by_path(absolute_path)
        if not entry:
            return False
        return self.remove(entry.review_id)

    def _load(self) -> dict[str, ReviewApprovalEntry]:
        if not self._path.exists():
            return {}
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

        raw_entries = data.get("entries", {})
        if not isinstance(raw_entries, dict):
            return {}

        entries: dict[str, ReviewApprovalEntry] = {}
        for key, value in raw_entries.items():
            if isinstance(value, dict):
                entry = ReviewApprovalEntry.from_dict(value)
                if entry.review_id:
                    entries[entry.review_id] = entry
        return entries

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "entries": {
                review_id: entry.to_dict()
                for review_id, entry in self._by_review_id.items()
            },
        }
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
