"""Tests for validation."""

from __future__ import annotations

from nasaq.models import BatchProposal
from nasaq.validators import validate_batch, validate_filename_component


def test_invalid_windows_chars():
    issues = validate_filename_component("bad:name")
    assert "invalid_windows_chars" in issues


def test_duplicate_proposed_names():
    proposals = [
        BatchProposal(file_id="a", proposed_full_name="topic - report - final.pdf"),
        BatchProposal(file_id="b", proposed_full_name="topic - report - final.pdf"),
    ]
    issues = validate_batch("/tmp/work", proposals)
    codes = [issue.code for issue in issues]
    assert "duplicate_proposed_name" in codes


def test_no_extension_warning():
    proposals = [
        BatchProposal(file_id="a", proposed_full_name="topic - report - final"),
    ]
    issues = validate_batch("/tmp/work", proposals)
    codes = [issue.code for issue in issues]
    assert "no_extension" in codes


def test_reserved_windows_name():
    issues = validate_filename_component("CON")
    assert "reserved_windows_name" in issues


def test_missing_source_file(tmp_path):
    missing = tmp_path / "missing.docx"
    proposals = [
        BatchProposal(file_id="a", proposed_full_name="topic - report - final.pdf"),
    ]
    issues = validate_batch(
        str(tmp_path),
        proposals,
        existing_paths={"a": str(missing)},
    )
    codes = [issue.code for issue in issues]
    assert "source_not_found" in codes
