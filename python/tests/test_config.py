"""Tests for configuration defaults and merging."""

from __future__ import annotations

import json

from nasaq.config import ConfigStore, default_config


def test_merge_adds_new_default_keywords_to_existing_config(tmp_path):
    path = tmp_path / "config.json"
    path.write_text(
        json.dumps(
            {
                "documentTypes": ["تقرير"],
                "versionStatusKeywords": ["معتمد", "مستلمة"],
                "noiseWords": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    config = ConfigStore(str(path)).config
    defaults = default_config()

    assert "تقرير" in config.document_types
    assert "احتياجات الاعمال" in config.document_types
    assert "معتمد" in config.version_status_keywords
    assert "مستلمة" in config.version_status_keywords
    assert "مختصرة" in config.version_status_keywords
    assert "مراجعة" in config.version_status_keywords
    assert len(config.document_types) >= len(defaults.document_types)
