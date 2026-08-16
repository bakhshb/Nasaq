"""Version and status detection from filename text."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List

from nasaq.naming.normalize import normalize_for_match, normalize_text

_DATE_ISO = re.compile(r"\b(\d{4}-\d{2}-\d{2})\b")
_DATE_SLASH = re.compile(r"\b(\d{4}/\d{2}/\d{2})\b")
_DATE_DMY = re.compile(r"\b(\d{2}-\d{2}-\d{4})\b")
_DATE_DMY_SLASH = re.compile(r"\b(\d{2}/\d{2}/\d{4})\b")
_DATE_TAIL_PATTERNS = (
    r"(\d{4}-\d{2}-\d{2})",
    r"(\d{4}/\d{2}/\d{2})",
    r"(\d{2}-\d{2}-\d{4})",
    r"(\d{2}/\d{2}/\d{4})",
)
_QUARTER = re.compile(r"\b(Q[1-4]\s+\d{4})\b", re.IGNORECASE)
_QUARTER_SHORT = re.compile(r"\b(Q[1-4])\b", re.IGNORECASE)
_VERSION_V = re.compile(r"\b(V\d+)\b", re.IGNORECASE)
_VERSION_NUM = re.compile(r"(?:نسخة\s*)?(\d+)\s*$")
_VERSION_END = re.compile(r"\b(V\d+|Q[1-4]|\d+)\s*$", re.IGNORECASE)


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

    keyword_date_match = _match_keyword_with_date(raw, keywords)
    if keyword_date_match:
        return keyword_date_match

    # Dates and V-patterns must be detected before dash-to-space normalization.
    for pattern, kind in (
        (_DATE_ISO, "date"),
        (_DATE_SLASH, "date"),
        (_DATE_DMY, "date"),
        (_DATE_DMY_SLASH, "date"),
        (_QUARTER, "date"),
        (_VERSION_V, "version"),
        (_QUARTER_SHORT, "version"),
    ):
        match = pattern.search(raw)
        if match:
            value = match.group(1)
            if kind == "version" and _QUARTER_SHORT.fullmatch(value):
                value = value.upper()
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
        if value.upper().startswith("V") or value.upper().startswith("Q") or value.isdigit():
            normalized_value = value.upper() if value.upper().startswith(("V", "Q")) else value
            return VersionStatusMatch(
                value=normalized_value,
                matched_text=value,
                confidence=0.75,
                kind="version",
            )

    return None


def _match_keyword_with_date(raw: str, keywords: List[str]) -> VersionStatusMatch | None:
    text = raw.strip()
    if not text:
        return None

    for keyword in sorted(keywords, key=len, reverse=True):
        key = keyword.strip()
        if not key:
            continue
        escaped = re.escape(key)
        for tail in _DATE_TAIL_PATTERNS:
            if re.fullmatch(rf"{escaped}\s+{tail}", text, flags=re.IGNORECASE):
                return VersionStatusMatch(
                    value=text,
                    matched_text=text,
                    confidence=0.9,
                    kind="keyword",
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
