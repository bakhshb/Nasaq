"""Regression tests driven by python/fixtures/naming-history.json."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nasaq.config import default_config
from nasaq.models import ScannedFile
from nasaq.naming.engine import analyze_file
from nasaq.naming.normalize import split_extension

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "naming-history.json"


def _load_cases() -> list[dict]:
    data = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    return list(data["cases"])


def _scanned_from_case(case: dict) -> ScannedFile:
    filename = case["filename"]
    stem, ext = split_extension(filename)
    folder = case.get("folder", "")
    relative = f"{folder}/{filename}" if folder else filename
    root = "/tmp/work"
    absolute = f"{root}/{relative}"
    return ScannedFile(
        id=case["id"],
        absolute_path=absolute,
        relative_path=relative,
        extension=ext,
        current_name=stem,
        folder_name=folder,
    )


@pytest.mark.parametrize("case", _load_cases(), ids=[case["id"] for case in _load_cases()])
def test_naming_history_cases(case: dict):
    config = default_config()
    result = analyze_file(_scanned_from_case(case), config)
    expected = case["expected"]

    assert result.topic == expected["topic"]
    assert result.document_type == expected["documentType"]
    assert result.version_status == expected["versionStatus"]
    assert result.proposed_full_name == expected["proposedFullName"]
