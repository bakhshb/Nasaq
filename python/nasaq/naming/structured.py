"""Parse filenames that already follow the configured separator layout."""

from __future__ import annotations

import re

from nasaq.naming.doc_type import _build_match_terms
from nasaq.naming.normalize import normalize_for_match
from nasaq.naming.version_status import match_version_status

_QUARTER_SHORT = re.compile(r"^Q[1-4]$", re.IGNORECASE)


def try_parse_structured_name(
    current_name: str,
    separator: str,
    document_types: list[str],
    aliases: dict[str, str],
    version_keywords: list[str],
) -> tuple[str, str, str] | None:
    """Return topic, document_type, version_status when name matches topic - type - version."""
    name = current_name.strip()
    if not name or not separator or separator not in name:
        return None

    parts = [part.strip() for part in name.split(separator)]
    parts = [part for part in parts if part]
    if len(parts) < 2:
        return None

    version = ""
    body = list(parts)

    if len(body) >= 3 and _segment_is_version(body[-1], version_keywords):
        version = _normalize_version_segment(body[-1], version_keywords)
        body = body[:-1]

    if len(body) < 2:
        topic = body[0] if body else ""
        if not topic:
            return None
        return topic, "", version

    topic, document_type = _resolve_topic_and_document_type(
        body,
        separator,
        document_types,
        aliases,
    )
    if not topic:
        return None

    return topic, document_type, version


def _resolve_topic_and_document_type(
    body: list[str],
    separator: str,
    document_types: list[str],
    aliases: dict[str, str],
) -> tuple[str, str]:
    if len(body) == 1:
        return body[0], ""

    if len(body) == 2:
        first, second = body
        first_type = _match_doc_type_segment(first, document_types, aliases)
        second_type = _match_doc_type_segment(second, document_types, aliases)

        if first_type and not second_type:
            return second, first_type
        if second_type and not first_type:
            return first, second_type

        document_type = second_type or second
        return first, document_type

    potential_type = body[-1]
    topic = separator.join(body[:-1]).strip()
    document_type = _match_doc_type_segment(potential_type, document_types, aliases)
    if not document_type:
        document_type = potential_type

    return topic, document_type


def _segment_is_version(segment: str, version_keywords: list[str]) -> bool:
    text = segment.strip()
    if not text:
        return False
    if match_version_status(text, version_keywords):
        return True
    return _QUARTER_SHORT.fullmatch(text) is not None


def _normalize_version_segment(segment: str, version_keywords: list[str]) -> str:
    text = segment.strip()
    if _QUARTER_SHORT.fullmatch(text):
        return text.upper()
    match = match_version_status(text, version_keywords)
    if match:
        # Keep qualifier phrases intact (e.g. "رد على فريق العمل الدائم") instead of
        # collapsing to the leading keyword ("رد") when the segment is already isolated.
        if (
            match.kind == "keyword"
            and normalize_for_match(match.value) != normalize_for_match(text)
        ):
            return text
        return match.value
    return text


def _match_doc_type_segment(
    segment: str,
    document_types: list[str],
    aliases: dict[str, str],
) -> str:
    segment_norm = normalize_for_match(segment)
    if not segment_norm:
        return ""

    for match_key, canonical, _display in _build_match_terms(document_types, aliases):
        if segment_norm == match_key:
            return canonical

    return ""
