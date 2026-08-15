"""Text normalization for filename analysis."""

from __future__ import annotations

import re
import unicodedata

_MULTI_SPACE = re.compile(r"\s+")
_SEPARATORS = re.compile(r"[\-–—|_/\\]+")


def normalize_text(text: str) -> str:
    """Normalize Unicode and whitespace for matching."""
    if not text:
        return ""
    normalized = unicodedata.normalize("NFC", text.strip())
    normalized = _SEPARATORS.sub(" ", normalized)
    normalized = _MULTI_SPACE.sub(" ", normalized)
    return normalized.strip()


def normalize_for_match(text: str) -> str:
    """Case-fold Latin letters for loose matching."""
    return normalize_text(text).casefold()


def split_extension(filename: str) -> tuple[str, str]:
    """Return basename without extension and extension (with dot, or empty)."""
    if not filename:
        return "", ""
    if filename.startswith(".") and filename.count(".") == 1:
        return filename, ""
    if "." not in filename:
        return filename, ""
    stem, ext = filename.rsplit(".", 1)
    if not stem:
        return filename, ""
    return stem, f".{ext}"
