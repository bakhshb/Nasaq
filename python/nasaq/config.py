"""Configuration loading, defaults, and persistence."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Optional

from nasaq.models import AppConfig

DEFAULT_DOCUMENT_TYPES = [
    "بطاقة مبادرة",
    "طلب تغيير",
    "تقرير",
    "خطاب",
    "محضر اجتماع",
    "عرض تقديمي",
    "خطة",
    "دراسة",
    "وثيقة إجراءات",
    "نطاق عمل",
    "احتياجات الاعمال",
]

DEFAULT_DOCUMENT_TYPE_ALIASES = {
    "بطاقة المبادرة": "بطاقة مبادرة",
    "بطاقه مبادرة": "بطاقة مبادرة",
    "محضر": "محضر اجتماع",
}

DEFAULT_VERSION_STATUS_KEYWORDS = [
    "معتمد",
    "وارد",
    "صادر",
    "مستلمة",
    "مستلم",
    "مستملة",
    "نهائي",
    "مسودة",
    "تحديث",
    "نسخة",
    "مختصرة",
    "مفصلة",
    "رد",
    "مرسلة",
    "مرسل",
    "مصدرة",
    "مصدر",
    "مراجعة",
]

DEFAULT_NOISE_WORDS = [
    "لمبادرة",
    "مبادرة",
    "لوكالة تطوير الاعمال",
    "وكالة تطوير الاعمال",
    "لوكالة تطوير الأعمال",
    "وكالة تطوير الأعمال",
]


def default_config() -> AppConfig:
    return AppConfig(
        document_types=list(DEFAULT_DOCUMENT_TYPES),
        document_type_aliases=dict(DEFAULT_DOCUMENT_TYPE_ALIASES),
        version_status_keywords=list(DEFAULT_VERSION_STATUS_KEYWORDS),
        noise_words=list(DEFAULT_NOISE_WORDS),
    )


def get_config_path(explicit: Optional[str] = None) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    env_path = os.environ.get("NASAQ_CONFIG_PATH")
    if env_path:
        return Path(env_path).expanduser()
    return Path.home() / ".config" / "nasaq" / "config.json"


class ConfigStore:
    def __init__(self, path: Optional[str] = None) -> None:
        self._path = get_config_path(path)
        self._config = self._load()

    @property
    def path(self) -> Path:
        return self._path

    @property
    def config(self) -> AppConfig:
        return self._config

    def get(self) -> AppConfig:
        return self._config

    def update(self, partial: dict) -> AppConfig:
        merged = self._config.to_dict()
        for key, value in partial.items():
            if key == "scan" and isinstance(value, dict):
                merged["scan"] = {**merged.get("scan", {}), **value}
            elif key == "naming" and isinstance(value, dict):
                merged["naming"] = {**merged.get("naming", {}), **value}
            else:
                merged[key] = value
        self._config = AppConfig.from_dict(merged)
        self._save()
        return self._config

    def _load(self) -> AppConfig:
        if not self._path.exists():
            config = default_config()
            self._save(config)
            return config
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            config = AppConfig.from_dict(data)
            return self._merge_with_defaults(config)
        except (json.JSONDecodeError, OSError):
            return default_config()

    def _merge_with_defaults(self, config: AppConfig) -> AppConfig:
        defaults = default_config()
        if not config.document_types:
            config.document_types = list(defaults.document_types)
        for alias, canonical in defaults.document_type_aliases.items():
            config.document_type_aliases.setdefault(alias, canonical)
        if not config.version_status_keywords:
            config.version_status_keywords = list(defaults.version_status_keywords)
        if not config.noise_words:
            config.noise_words = list(defaults.noise_words)
        return config

    def _save(self, config: Optional[AppConfig] = None) -> None:
        target = config or self._config
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._path.write_text(
            json.dumps(target.to_dict(), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
