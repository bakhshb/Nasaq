"""Tests for naming engine."""

from __future__ import annotations

import pytest

from nasaq.config import default_config
from nasaq.models import ScannedFile
from nasaq.naming.builder import build_proposed_full_name, build_proposed_name
from nasaq.naming.engine import analyze_file
from nasaq.naming.normalize import normalize_text, split_extension


def _scanned(
    filename: str,
    folder: str = "",
    root: str = "/tmp/work",
) -> ScannedFile:
    stem, ext = split_extension(filename)
    return ScannedFile(
        id="test-id",
        absolute_path=f"{root}/{filename}",
        relative_path=filename,
        extension=ext,
        current_name=stem,
        folder_name=folder,
    )


def test_primary_arabic_example():
    config = default_config()
    result = analyze_file(
        _scanned("بطاقة المبادرة لمبادرة تقليص الظل مستلمة.xlsx"),
        config,
    )

    assert result.document_type == "بطاقة مبادرة"
    assert result.topic == "تقليص الظل"
    assert result.version_status == "مستلمة"
    assert result.proposed_name == "تقليص الظل - بطاقة مبادرة - مستلمة"
    assert result.proposed_full_name == "تقليص الظل - بطاقة مبادرة - مستلمة.xlsx"


def test_no_document_type():
    config = default_config()
    result = analyze_file(_scanned("تقليص الظل معتمد.pdf"), config)

    assert result.document_type == ""
    assert "no_document_type_detected" in result.warnings
    assert result.topic
    assert result.version_status == "معتمد"


def test_no_version_status():
    config = default_config()
    result = analyze_file(_scanned("تقرير تقليص الظل.docx"), config)

    assert result.document_type == "تقرير"
    assert result.topic == "تقليص الظل"
    assert result.version_status == ""
    assert result.proposed_name == "تقليص الظل - تقرير"


def test_date_as_version_status():
    config = default_config()
    result = analyze_file(_scanned("خطة مركز الابتكار 2026-08-15.pptx"), config)

    assert result.document_type == "خطة"
    assert result.topic == "مركز الابتكار"
    assert result.version_status == "2026-08-15"
    assert "2026-08-15" in result.proposed_name


def test_v3_version():
    config = default_config()
    result = analyze_file(_scanned("Study Innovation Center V3.docx"), config)

    assert result.version_status.upper() == "V3"
    assert "V3" in result.proposed_full_name


def test_english_filename():
    config = default_config()
    result = analyze_file(_scanned("Final Report Shadow Reduction Approved.pdf"), config)

    assert result.proposed_name
    assert result.proposed_full_name.endswith(".pdf")


def test_file_without_extension():
    config = default_config()
    result = analyze_file(_scanned("تقرير تقليص الظل"), config)

    assert result.scanned.extension == ""
    assert result.document_type == "تقرير"
    assert result.proposed_full_name == result.proposed_name


def test_build_proposed_name_optional_third_part():
    name = build_proposed_name("تقليص الظل", "تقرير", "")
    assert name == "تقليص الظل - تقرير"

    full = build_proposed_full_name(name, ".pdf")
    assert full == "تقليص الظل - تقرير.pdf"


def test_normalize_collapses_separators():
    assert normalize_text("topic - type - status") == "topic type status"


def test_structured_name_with_q3_version():
    config = default_config()
    name = "مكتب إدارة المشاريع و التوعية والتدريب - تقرير - Q3"
    result = analyze_file(_scanned(name + ".pdf", folder="ادارة المشاريع"), config)

    assert result.topic == "مكتب إدارة المشاريع و التوعية والتدريب"
    assert result.document_type == "تقرير"
    assert result.version_status == "Q3"
    assert result.proposed_full_name == name + ".pdf"


def test_structured_name_in_subfolder():
    config = default_config()
    name = "ادارة المشاريع - احتياجات الاعمال - مختصرة"
    result = analyze_file(
        ScannedFile(
            id="test-id",
            absolute_path=f"/tmp/work/sub/{name}.pdf",
            relative_path=f"sub/{name}.pdf",
            extension=".pdf",
            current_name=name,
            folder_name="ادارة المشاريع",
        ),
        config,
    )

    assert result.topic == "ادارة المشاريع"
    assert result.document_type == "احتياجات الاعمال"
    assert result.version_status == "مختصرة"
    assert result.proposed_full_name == name + ".pdf"


def test_structured_name_reorders_swapped_topic_and_document_type():
    config = default_config()
    misnamed = "احتياجات الاعمال - ادارة المشاريع - مختصرة"
    expected = "ادارة المشاريع - احتياجات الاعمال - مختصرة"
    result = analyze_file(
        ScannedFile(
            id="test-id",
            absolute_path=f"/tmp/work/sub/{misnamed}.pdf",
            relative_path=f"sub/{misnamed}.pdf",
            extension=".pdf",
            current_name=misnamed,
            folder_name="ادارة المشاريع",
        ),
        config,
    )

    assert result.topic == "ادارة المشاريع"
    assert result.document_type == "احتياجات الاعمال"
    assert result.version_status == "مختصرة"
    assert result.proposed_name == expected


@pytest.mark.parametrize(
    ("status",),
    [
        ("مستلمة",),
        ("مستملة",),
        ("رد",),
        ("مرسلة",),
        ("مصدرة",),
        ("مرسلة 28-08-2026",),
        ("مرسلة 28/08/2026",),
    ],
)
def test_structured_name_with_document_status_keywords(status: str):
    config = default_config()
    name = f"ادارة المشاريع - احتياجات الاعمال - {status}"
    result = analyze_file(
        ScannedFile(
            id="test-id",
            absolute_path=f"/tmp/work/sub/{name}.pdf",
            relative_path=f"sub/{name}.pdf",
            extension=".pdf",
            current_name=name,
            folder_name="ادارة المشاريع",
        ),
        config,
    )

    assert result.topic == "ادارة المشاريع"
    assert result.document_type == "احتياجات الاعمال"
    assert result.version_status == status
    assert result.proposed_full_name == name + ".pdf"


def test_structured_name_with_review_and_arabic_month():
    config = default_config()
    name = "نظام انجاز تنفيذي - تقرير - مراجعة 2 اغسطس"
    result = analyze_file(_scanned(name + ".pdf"), config)

    assert result.topic == "نظام انجاز تنفيذي"
    assert result.document_type == "تقرير"
    assert result.version_status == "مراجعة 2 اغسطس"
    assert result.proposed_full_name == name + ".pdf"


def test_structured_name_with_final_version_phrase():
    config = default_config()
    name = "نظام انجاز تنفيذي - تقرير - النسخة النهائية"
    result = analyze_file(_scanned(name + ".pdf"), config)

    assert result.topic == "نظام انجاز تنفيذي"
    assert result.document_type == "تقرير"
    assert result.version_status == "النسخة النهائية"
    assert result.proposed_full_name == name + ".pdf"
