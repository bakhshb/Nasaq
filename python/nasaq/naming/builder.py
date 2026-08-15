"""Build proposed filename from naming fields."""

from __future__ import annotations


def build_proposed_name(
    topic: str,
    document_type: str,
    version_status: str,
    separator: str = " - ",
) -> str:
    parts: list[str] = []
    topic = topic.strip()
    document_type = document_type.strip()
    version_status = version_status.strip()

    if topic:
        parts.append(topic)
    if document_type:
        parts.append(document_type)
    if version_status:
        parts.append(version_status)

    return separator.join(parts)


def build_proposed_full_name(
    proposed_name: str,
    extension: str,
) -> str:
    ext = extension if extension.startswith(".") else f".{extension}" if extension else ""
    if not proposed_name:
        return ext.lstrip(".") if ext else ""
    return f"{proposed_name}{ext}"
