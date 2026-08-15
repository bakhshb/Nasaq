"""Document type detection from filename text."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

from nasaq.naming.normalize import normalize_for_match, normalize_text


@dataclass
class DocumentTypeMatch:
    canonical: str
    matched_text: str
    confidence: float


def _build_match_terms(
    document_types: List[str],
    aliases: Dict[str, str],
) -> List[Tuple[str, str, str]]:
    """Return (match_key, canonical, display_form) sorted longest-first."""
    entries: List[Tuple[str, str, str]] = []
    seen_keys: set[str] = set()

    for doc_type in document_types:
        key = normalize_for_match(doc_type)
        if key and key not in seen_keys:
            seen_keys.add(key)
            entries.append((key, doc_type, doc_type))

    for alias, canonical in aliases.items():
        key = normalize_for_match(alias)
        if key and key not in seen_keys:
            seen_keys.add(key)
            entries.append((key, canonical, alias))

    entries.sort(key=lambda item: len(item[0]), reverse=True)
    return entries


def match_document_type(
    text: str,
    document_types: List[str],
    aliases: Dict[str, str],
) -> DocumentTypeMatch | None:
    normalized = normalize_for_match(text)
    if not normalized:
        return None

    best: DocumentTypeMatch | None = None
    for match_key, canonical, display_form in _build_match_terms(document_types, aliases):
        if match_key in normalized:
            matched_text = _extract_matched_phrase(text, match_key) or display_form
            confidence = max(0.6, min(1.0, len(match_key) / max(len(normalized), 1)))
            candidate = DocumentTypeMatch(
                canonical=canonical,
                matched_text=matched_text,
                confidence=confidence,
            )
            if best is None or len(match_key) > len(normalize_for_match(best.matched_text)):
                best = candidate
    return best


def remove_document_type(text: str, matched_text: str) -> str:
    """Remove matched document type phrase from text."""
    if not matched_text:
        return normalize_text(text)
    result = text
    for variant in {matched_text, normalize_text(matched_text)}:
        if variant:
            result = result.replace(variant, " ")
    return normalize_text(result)


def _extract_matched_phrase(text: str, match_key: str) -> str:
    words = normalize_text(text).split()
    key_words = match_key.split()
    if not key_words:
        return ""
    for i in range(len(words) - len(key_words) + 1):
        segment = " ".join(words[i:i + len(key_words)])
        if normalize_for_match(segment) == match_key:
            return segment
    return ""
