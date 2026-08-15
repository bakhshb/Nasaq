"""Directory scanning for files."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import List

from nasaq.models import AppConfig, ScannedFile
from nasaq.naming.normalize import split_extension


def scan_directory(root_path: str, config: AppConfig) -> List[ScannedFile]:
    root = Path(root_path).resolve()
    if not root.is_dir():
        raise ValueError(f"Not a directory: {root_path}")

    iterator = root.rglob("*") if config.scan.recursive else root.glob("*")
    results: List[ScannedFile] = []

    for path in sorted(iterator):
        if not path.is_file():
            continue
        if _should_skip(path):
            continue
        if not _matches_extension(path, config.scan.extensions):
            continue

        stat = path.stat()
        relative = path.relative_to(root)
        current_name, extension = split_extension(path.name)
        folder_name = path.parent.name if path.parent != root else ""

        file_id = _make_id(str(path))
        modified = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()

        results.append(
            ScannedFile(
                id=file_id,
                absolute_path=str(path),
                relative_path=str(relative),
                extension=extension,
                current_name=current_name,
                folder_name=folder_name,
                size_bytes=stat.st_size,
                modified_at=modified,
            )
        )

    return results


def _make_id(absolute_path: str) -> str:
    return hashlib.sha256(absolute_path.encode("utf-8")).hexdigest()[:16]


def _should_skip(path: Path) -> bool:
    name = path.name
    if name.startswith("."):
        return True
    return False


def _matches_extension(path: Path, extensions: List[str]) -> bool:
    if not extensions or extensions == ["*"]:
        return True
    suffix = path.suffix.casefold()
    normalized = [ext if ext.startswith(".") else f".{ext}" for ext in extensions]
    return suffix.casefold() in {e.casefold() for e in normalized}
