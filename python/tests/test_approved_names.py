"""Tests for approved naming persistence."""

from __future__ import annotations

from nasaq.approved_names import ApprovedNamesStore
from nasaq.config import default_config
from nasaq.models import ScannedFile
from nasaq.naming.engine import analyze_file
from nasaq.naming.normalize import split_extension


def _scanned(filename: str, absolute_path: str) -> ScannedFile:
    stem, ext = split_extension(filename)
    return ScannedFile(
        id="approved-test",
        absolute_path=absolute_path,
        relative_path=filename,
        extension=ext,
        current_name=stem,
        folder_name="",
    )


def test_save_and_lookup_approved_name(tmp_path):
    store_path = tmp_path / "approved-names.json"
    store = ApprovedNamesStore(str(store_path))
    root = str(tmp_path / "work")
    from_path = f"{root}/old-name.pptx"
    to_path = f"{root}/مركز التفويج - عرض تقديمي - رد على فريق العمل الدائم.pptx"

    store.save_after_rename(
        root,
        [
            {
                "fromPath": from_path,
                "toPath": to_path,
                "topic": "مركز التفويج",
                "documentType": "عرض تقديمي",
                "versionStatus": "رد على فريق العمل الدائم",
                "proposedFullName": "مركز التفويج - عرض تقديمي - رد على فريق العمل الدائم.pptx",
                "relativePath": "مركز التفويج - عرض تقديمي - رد على فريق العمل الدائم.pptx",
            }
        ],
    )

    entry = store.lookup(
        to_path,
        "مركز التفويج - عرض تقديمي - رد على فريق العمل الدائم.pptx",
    )
    assert entry is not None
    assert entry.version_status == "رد على فريق العمل الدائم"


def test_apply_approved_name_overrides_engine_parse(tmp_path):
    store_path = tmp_path / "approved-names.json"
    store = ApprovedNamesStore(str(store_path))
    config = default_config()
    filename = "مركز التفويج - عرض تقديمي - رد على فريق العمل الدائم.pptx"
    absolute_path = str(tmp_path / filename)

    store.save_after_rename(
        str(tmp_path),
        [
            {
                "fromPath": absolute_path,
                "toPath": absolute_path,
                "topic": "مركز التفويج",
                "documentType": "عرض تقديمي",
                "versionStatus": "رد على فريق العمل الدائم",
                "proposedFullName": filename,
                "relativePath": filename,
            }
        ],
    )

    raw = analyze_file(_scanned(filename, absolute_path), config)
    assert raw.version_status == "رد على فريق العمل الدائم"

    broken = analyze_file(_scanned(filename, absolute_path), config)
    broken.version_status = "رد"
    broken.proposed_name = "مركز التفويج - عرض تقديمي - رد"
    broken.proposed_full_name = "مركز التفويج - عرض تقديمي - رد.pptx"

    applied = store.apply_to_result(broken, config)
    assert applied.version_status == "رد على فريق العمل الدائم"
    assert applied.proposed_full_name == filename
    assert "approved_name_applied" in applied.warnings


def test_revert_after_undo_removes_entry(tmp_path):
    store_path = tmp_path / "approved-names.json"
    store = ApprovedNamesStore(str(store_path))
    to_path = str(tmp_path / "approved.pptx")

    store.save_after_rename(
        str(tmp_path),
        [
            {
                "fromPath": str(tmp_path / "old.pptx"),
                "toPath": to_path,
                "topic": "موضوع",
                "documentType": "تقرير",
                "versionStatus": "معتمد",
                "proposedFullName": "approved.pptx",
                "relativePath": "approved.pptx",
            }
        ],
    )

    removed = store.revert_after_undo([{"fromPath": str(tmp_path / "old.pptx"), "toPath": to_path}])
    assert removed == 1
    assert store.lookup(to_path, "approved.pptx") is None


def test_lookup_removes_stale_entry_when_filename_changed(tmp_path):
    store_path = tmp_path / "approved-names.json"
    store = ApprovedNamesStore(str(store_path))
    absolute_path = str(tmp_path / "file.pptx")

    store.save_after_rename(
        str(tmp_path),
        [
            {
                "fromPath": absolute_path,
                "toPath": absolute_path,
                "topic": "موضوع",
                "documentType": "تقرير",
                "versionStatus": "",
                "proposedFullName": "file.pptx",
                "relativePath": "file.pptx",
            }
        ],
    )

    assert store.lookup(absolute_path, "renamed-later.pptx") is None
    assert store.lookup(absolute_path, "file.pptx") is None
    assert store_path.read_text(encoding="utf-8").find(absolute_path) == -1


def test_lookup_removes_stale_short_approval_when_disk_has_long_name(tmp_path):
    store_path = tmp_path / "approved-names.json"
    store = ApprovedNamesStore(str(store_path))
    absolute_path = str(tmp_path / "file.pptx")

    store.save_after_rename(
        str(tmp_path),
        [
            {
                "fromPath": absolute_path,
                "toPath": absolute_path,
                "topic": "موضوع",
                "documentType": "تقرير",
                "versionStatus": "رد",
                "proposedFullName": "موضوع - تقرير - رد.pptx",
                "relativePath": "file.pptx",
            }
        ],
    )

    long_name = "موضوع - تقرير - رد على استفسار فريق العمل الدائم.pptx"
    assert store.lookup(absolute_path, long_name) is None
    assert store.lookup(absolute_path, "موضوع - تقرير - رد.pptx") is None
