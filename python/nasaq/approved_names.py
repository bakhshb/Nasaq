"""Persistent store for user-approved filename naming fields."""

from __future__ import annotations

import json
import os
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from nasaq.config import get_config_path
from nasaq.models import AnalysisResult, AppConfig
from nasaq.naming.builder import build_proposed_full_name, build_proposed_name


def normalize_filename(name: str) -> str:
    return unicodedata.normalize("NFC", name.strip().casefold())


def filenames_match(a: str, b: str) -> bool:
    return normalize_filename(a) == normalize_filename(b)


def get_approved_names_path(explicit: Optional[str] = None) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    env_path = os.environ.get("NASAQ_APPROVED_NAMES_PATH")
    if env_path:
        return Path(env_path).expanduser()
    return get_config_path().parent / "approved-names.json"


def _normalize_path_key(path: str) -> str:
    return str(Path(path).expanduser().resolve())


@dataclass
class ApprovedNameEntry:
    topic: str
    document_type: str
    version_status: str
    approved_full_name: str
    root_path: str = ""
    relative_path: str = ""
    updated_at: str = ""

    def to_dict(self) -> dict[str, str]:
        return {
            "topic": self.topic,
            "documentType": self.document_type,
            "versionStatus": self.version_status,
            "approvedFullName": self.approved_full_name,
            "rootPath": self.root_path,
            "relativePath": self.relative_path,
            "updatedAt": self.updated_at,
        }

    @staticmethod
    def from_dict(data: dict) -> ApprovedNameEntry:
        return ApprovedNameEntry(
            topic=str(data.get("topic", "")),
            document_type=str(data.get("documentType", "")),
            version_status=str(data.get("versionStatus", "")),
            approved_full_name=str(data.get("approvedFullName", "")),
            root_path=str(data.get("rootPath", "")),
            relative_path=str(data.get("relativePath", "")),
            updated_at=str(data.get("updatedAt", "")),
        )


class ApprovedNamesStore:
    def __init__(self, path: Optional[str] = None) -> None:
        self._path = get_approved_names_path(path)
        self._entries: dict[str, ApprovedNameEntry] = self._load()

    @property
    def path(self) -> Path:
        return self._path

    def lookup(self, absolute_path: str, current_full_name: str) -> ApprovedNameEntry | None:
        key = _normalize_path_key(absolute_path)
        entry = self._entries.get(key)
        if not entry:
            return None
        if not filenames_match(entry.approved_full_name, current_full_name):
            self._entries.pop(key, None)
            self._save()
            return None
        return entry

    def save_after_rename(
        self,
        root_path: str,
        items: list[dict],
    ) -> int:
        saved = 0
        now = datetime.now(timezone.utc).isoformat()

        for item in items:
            from_path = str(item.get("fromPath", "")).strip()
            to_path = str(item.get("toPath", "")).strip()
            if not to_path:
                continue

            if from_path:
                self._entries.pop(_normalize_path_key(from_path), None)

            proposed_full_name = str(item.get("proposedFullName", "")).strip()
            if not proposed_full_name:
                continue

            relative_path = str(item.get("relativePath", "")).strip()
            if not relative_path and root_path and to_path.startswith(root_path):
                relative_path = str(Path(to_path).relative_to(Path(root_path).resolve()))

            self._entries[_normalize_path_key(to_path)] = ApprovedNameEntry(
                topic=str(item.get("topic", "")),
                document_type=str(item.get("documentType", "")),
                version_status=str(item.get("versionStatus", "")),
                approved_full_name=proposed_full_name,
                root_path=root_path,
                relative_path=relative_path,
                updated_at=now,
            )
            saved += 1

        if saved:
            self._save()
        return saved

    def revert_after_undo(self, moves: list[dict]) -> int:
        removed = 0
        for move in moves:
            to_path = str(move.get("toPath", "")).strip()
            if not to_path:
                continue
            if self._entries.pop(_normalize_path_key(to_path), None):
                removed += 1
        if removed:
            self._save()
        return removed

    def apply_to_result(
        self,
        result: AnalysisResult,
        config: AppConfig,
    ) -> AnalysisResult:
        current_full_name = result.scanned.current_name + result.scanned.extension
        entry = self.lookup(result.scanned.absolute_path, current_full_name)
        if not entry:
            return result

        proposed_name = build_proposed_name(
            entry.topic,
            entry.document_type,
            entry.version_status,
            config.naming.separator,
        )
        proposed_full_name = build_proposed_full_name(
            proposed_name,
            result.scanned.extension,
        )

        warnings = [warning for warning in result.warnings if warning != "low_confidence"]
        if "approved_name_applied" not in warnings:
            warnings.append("approved_name_applied")

        return AnalysisResult(
            scanned=result.scanned,
            document_type=entry.document_type,
            topic=entry.topic,
            version_status=entry.version_status,
            proposed_name=proposed_name,
            proposed_full_name=proposed_full_name,
            confidence=result.confidence,
            warnings=warnings,
        )

    def _load(self) -> dict[str, ApprovedNameEntry]:
        if not self._path.exists():
            return {}
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}

        raw_entries = data.get("entries", {})
        if not isinstance(raw_entries, dict):
            return {}

        entries: dict[str, ApprovedNameEntry] = {}
        for key, value in raw_entries.items():
            if isinstance(value, dict):
                entries[str(key)] = ApprovedNameEntry.from_dict(value)
        return entries

    def _save(self) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": 1,
            "entries": {
                key: entry.to_dict()
                for key, entry in self._entries.items()
            },
        }
        self._path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
