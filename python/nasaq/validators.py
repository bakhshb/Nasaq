"""Filename and batch validation."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, List, Optional

from nasaq.models import BatchProposal, ValidationIssue

WINDOWS_INVALID_CHARS = re.compile(r'[<>:"/\\|?*]')
WINDOWS_INVALID_NAMES = frozenset(
    {
        "",
        ".",
        "..",
        "CON",
        "PRN",
        "AUX",
        "NUL",
        "COM1",
        "COM2",
        "COM3",
        "COM4",
        "COM5",
        "COM6",
        "COM7",
        "COM8",
        "COM9",
        "LPT1",
        "LPT2",
        "LPT3",
        "LPT4",
        "LPT5",
        "LPT6",
        "LPT7",
        "LPT8",
        "LPT9",
    }
)
MAX_WINDOWS_PATH_COMPONENT = 255


def validate_filename_component(name: str) -> List[str]:
    issues: List[str] = []
    if not name or not name.strip():
        issues.append("empty_name")
    if WINDOWS_INVALID_CHARS.search(name):
        issues.append("invalid_windows_chars")
    stripped = name.rstrip(". ")
    if stripped.upper() in WINDOWS_INVALID_NAMES:
        issues.append("reserved_windows_name")
    if len(name) > MAX_WINDOWS_PATH_COMPONENT:
        issues.append("name_too_long")
    return issues


def validate_batch(
    root_path: str,
    proposals: List[BatchProposal],
    existing_paths: Optional[Dict[str, str]] = None,
) -> List[ValidationIssue]:
    """Validate a batch of rename proposals."""
    issues: List[ValidationIssue] = []
    root = Path(root_path)
    seen_targets: Dict[str, str] = {}

    path_by_id = existing_paths or {}

    for proposal in proposals:
        full_name = proposal.proposed_full_name
        if not full_name:
            if proposal.proposed_name:
                full_name = proposal.proposed_name
            else:
                issues.append(
                    ValidationIssue(
                        file_id=proposal.file_id,
                        code="empty_proposed_name",
                        message="Proposed filename is empty.",
                    )
                )
                continue

        stem, ext = _split_full_name(full_name)
        for code in validate_filename_component(stem):
            issues.append(
                ValidationIssue(
                    file_id=proposal.file_id,
                    code=code,
                    message=f"Invalid proposed name: {code}",
                )
            )

        if not ext:
            issues.append(
                ValidationIssue(
                    file_id=proposal.file_id,
                    code="no_extension",
                    message="File has no extension; confirm rename is intentional.",
                )
            )

        target_key = full_name.casefold()
        if target_key in seen_targets:
            issues.append(
                ValidationIssue(
                    file_id=proposal.file_id,
                    code="duplicate_proposed_name",
                    message=f"Duplicate proposed name conflicts with file {seen_targets[target_key]}.",
                )
            )
        else:
            seen_targets[target_key] = proposal.file_id

        source_path = path_by_id.get(proposal.file_id)
        if source_path:
            source = Path(source_path)
            if not source.is_file():
                issues.append(
                    ValidationIssue(
                        file_id=proposal.file_id,
                        code="source_not_found",
                        message="Original file not found on disk. Rescan the folder and ensure OneDrive finished syncing.",
                    )
                )
            target = source.parent / full_name
            if target.exists() and target.resolve() != source.resolve():
                issues.append(
                    ValidationIssue(
                        file_id=proposal.file_id,
                        code="target_exists",
                        message=f"Target already exists: {target.name}",
                    )
                )

    return issues


def _split_full_name(full_name: str) -> tuple[str, str]:
    if "." not in full_name or full_name.startswith(".") and full_name.count(".") == 1:
        return full_name, ""
    stem, ext = full_name.rsplit(".", 1)
    if not stem:
        return full_name, ""
    return stem, f".{ext}"
