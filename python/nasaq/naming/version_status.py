"""Version and status detection from filename text."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from nasaq.naming.normalize import normalize_for_match, normalize_text

_DATE_ISO = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
_DATE_SLASH = re.compile(r"\b(\d{4}/\d{2}/\d{2})\b")
_DATE_DMY = re.compile(r"\b(\d{2}-\d{2}-\d{4})\b")
_QUARTER = re.compile(r"\b(Q[1-4]\s+\d{4})\b", re.IGNORECASE)
_VERSION_V = re.compile(r"\b(V\d+)\b", re.IGNORECASE)
_VERSION_NUM = re.compile(r"(?:نسخة\s*)?(\d+)\s*$")
_VERSION_END = re.compile(r"\b(V\d+|\d+)\s*$", re.IGNORECASE)


@dataclass
class VersionStatusMatch:
    value: str
    matched_text: str
    confidence: float
    kind: str  # keyword | date | version


def match_version_status(
    text: str,
    keywords: List[str],
) -> VersionStatusMatch | None:
    raw = text.strip()
    normalized = normalize_text(text)
    if not raw and not normalized:
        return None

    # Dates and V-patterns must be detected before dash-to-space normalization.
    for pattern, kind in (
        (_DATE_ISO, "date"),
        (_DATE_SLASH, "date"),
        (_DATE_DMY, "date"),
        (_QUARTER, "date"),
        (_VERSION_V, "version"),
    ):
        match = pattern.search(raw)
        if match:
            value = match.group(1)
            return VersionStatusMatch(
                value=value,
                matched_text=value,
                confidence=0.85,
                kind=kind,
            )

    if not normalized:
        return None

    keyword_match = _match_keyword(normalized, keywords)
    if keyword_match:
        return keyword_match

    end_match = _VERSION_END.search(normalized)
    if end_match:
        value = end_match.group(1)
        if value.upper().startswith("V") or value.isdigit():
            return VersionStatusMatch(
                value=value.upper() if value.upper().startswith("V") else value,
                matched_text=value,
                confidence=0.75,
                kind="version",
            )

    return None


def _match_keyword(text: str, keywords: List[str]) -> VersionStatusMatch | None:
    normalized = normalize_for_match(text)
    sorted_keywords = sorted(keywords, key=len, reverse=True)
    best: VersionStatusMatch | None = None

    for keyword in sorted_keywords:
        key = normalize_for_match(keyword)
        if not key:
            continue
        # Prefer keyword at end of string
        if normalized.endswith(key):
            display = _keyword_display(text, keyword)
            candidate = VersionStatusMatch(
                value=display,
                matched_text=display,
                confidence=0.9,
                kind="keyword",
            )
            if best is None or len(key) > len(normalize_for_match(best.matched_text)):
                best = candidate
        elif key in normalized:
            display = _keyword_display(text, keyword)
            candidate = VersionStatusMatch(
                value=display,
                matched_text=display,
                confidence=0.7,
                kind="keyword",
            )
            if best is None or len(key) > len(normalize_for_match(best.matched_text)):
                best = candidate

    return best


def _keyword_display(text: str, keyword: str) -> str:
    words = normalize_text(text).split()
    key_norm = normalize_for_match(keyword)
    for i in range(len(words) - 1, -1, -1):
        if normalize_for_match(words[i]) == key_norm:
            return words[i]
        # multi-word keyword at end
        for start in range(i, -1, -1):
            segment = " ".join(words[start:i + 1])
            if normalize_for_match(segment) == key_norm:
                return segment
    return keyword


def remove_version_status(text: str, matched_text: str) -> str:
    if not matched_text:
        return normalize_text(text)
    result = text
    for variant in {matched_text, normalize_text(matched_text)}:
        if not variant:
            continue
        if variant in result:
            result = result.replace(variant, " ")
            continue
        norm = normalize_text(result)
        norm_variant = normalize_text(variant)
        if norm.endswith(norm_variant):
            # Trim normalized tail by removing trailing words of the variant
            variant_words = norm_variant.split()
            norm_words = norm.split()
            if len(norm_words) >= len(variant_words):
                trimmed = " ".join(norm_words[: -len(variant_words)])
                result = trimmed
    return normalize_text(result)
