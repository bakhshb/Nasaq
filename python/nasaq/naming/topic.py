"""Topic extraction from remaining filename text."""

from __future__ import annotations

import re

from nasaq.naming.normalize import normalize_for_match, normalize_text

_GENERIC_FOLDER_NAMES = {
    "documents",
    "document",
    "files",
    "file",
    "temp",
    "tmp",
    "archive",
    "مستندات",
    "ملفات",
    "وثائق",
}


def extract_topic(
    remaining_text: str,
    folder_name: str = "",
    noise_words: list[str] | None = None,
) -> tuple[str, float]:
    text = normalize_text(remaining_text)
    if noise_words:
        text = _remove_noise_words(text, noise_words)

    if text:
        confidence = 0.75 if len(text.split()) <= 6 else 0.55
        return text, confidence

    folder_topic = _topic_from_folder(folder_name)
    if folder_topic:
        return folder_topic, 0.45

    return "", 0.2


def _remove_noise_words(text: str, noise_words: list[str]) -> str:
    result = text
    sorted_noise = sorted(noise_words, key=len, reverse=True)
    for noise in sorted_noise:
        noise_norm = normalize_for_match(noise)
        if not noise_norm:
            continue
        words = result.split()
        filtered: list[str] = []
        i = 0
        while i < len(words):
            matched = False
            for length in range(min(4, len(words) - i), 0, -1):
                segment = " ".join(words[i:i + length])
                if normalize_for_match(segment) == noise_norm:
                    i += length
                    matched = True
                    break
            if not matched:
                filtered.append(words[i])
                i += 1
        result = " ".join(filtered)
    return normalize_text(result)


def _topic_from_folder(folder_name: str) -> str:
    name = normalize_text(folder_name)
    if not name:
        return ""
    if normalize_for_match(name) in _GENERIC_FOLDER_NAMES:
        return ""
    if re.fullmatch(r"\d{4}", name):
        return ""
    return name
