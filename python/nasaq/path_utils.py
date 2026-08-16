"""Path resolution helpers for Unicode and Windows edge cases."""

from __future__ import annotations

import os
import sys
import unicodedata
from pathlib import Path


def normalize_path_text(path: str) -> str:
    """Normalize Unicode path text (NFC) and strip surrounding whitespace."""
    return unicodedata.normalize("NFC", path.strip())


def resolve_directory(root_path: str) -> Path:
    """Resolve a directory path, including Windows extended-length paths."""
    normalized = normalize_path_text(root_path)
    candidates: list[Path] = [Path(normalized)]

    if sys.platform == "win32":
        abs_path = os.path.abspath(normalized)
        candidates.append(Path(abs_path))
        if not abs_path.startswith("\\\\?\\"):
            candidates.append(Path("\\\\?\\" + abs_path))

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate)
        if key in seen:
            continue
        seen.add(key)

        try:
            resolved = candidate.resolve()
        except OSError:
            continue

        if resolved.is_dir():
            return resolved

    raise ValueError(f"Not a directory: {root_path}")
