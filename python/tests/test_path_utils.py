"""Tests for Unicode path resolution."""

from __future__ import annotations

import pytest

from nasaq.path_utils import normalize_path_text, resolve_directory
from nasaq.scanner import scan_directory
from nasaq.config import default_config


def test_normalize_path_text_strips_and_nfc():
    assert normalize_path_text("  /tmp/test  ") == "/tmp/test"


def test_resolve_directory(tmp_path):
    work = tmp_path / "الوزارة"
    work.mkdir()
    resolved = resolve_directory(str(work))
    assert resolved.is_dir()
    assert resolved.name == "الوزارة"


def test_resolve_directory_missing(tmp_path):
    missing = tmp_path / "missing"
    with pytest.raises(ValueError, match="Not a directory"):
        resolve_directory(str(missing))


def test_scan_directory_arabic_folder(tmp_path):
    work = tmp_path / "شركة كي بي ام جي"
    work.mkdir()
    sample = work / "تقرير.xlsx"
    sample.write_text("data", encoding="utf-8")

    config = default_config()
    config.scan.extensions = [".xlsx"]
    results = scan_directory(str(work), config)
    assert len(results) == 1
    assert results[0].current_name == "تقرير"
