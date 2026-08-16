"""Naming engine orchestrator."""

from __future__ import annotations

from nasaq.models import AppConfig, AnalysisResult, ConfidenceScores, ScannedFile
from nasaq.naming.builder import build_proposed_full_name, build_proposed_name
from nasaq.naming.doc_type import match_document_type, remove_document_type
from nasaq.naming.normalize import normalize_text
from nasaq.naming.structured import try_parse_structured_name
from nasaq.naming.topic import extract_topic
from nasaq.naming.version_status import match_version_status, remove_version_status


def analyze_file(scanned: ScannedFile, config: AppConfig) -> AnalysisResult:
    warnings: list[str] = []

    structured = try_parse_structured_name(
        scanned.current_name,
        config.naming.separator,
        config.document_types,
        config.document_type_aliases,
        config.version_status_keywords,
    )

    if structured:
        topic, document_type, version_status = structured
        doc_confidence = 0.95 if document_type else 0.2
        topic_confidence = 0.95 if topic else 0.2
        vs_confidence = 0.9 if version_status else 0.0

        if not document_type:
            warnings.append("no_document_type_detected")
        if not topic:
            warnings.append("no_topic_detected")

        proposed_name = build_proposed_name(
            topic,
            document_type,
            version_status,
            config.naming.separator,
        )
        proposed_full_name = build_proposed_full_name(proposed_name, scanned.extension)

        if not proposed_name:
            warnings.append("empty_proposed_name")
            proposed_full_name = scanned.current_name + scanned.extension

        overall = _overall_confidence(doc_confidence, topic_confidence, vs_confidence)
        if overall < 0.5:
            warnings.append("low_confidence")

        confidence = ConfidenceScores(
            topic=topic_confidence,
            document_type=doc_confidence,
            version_status=vs_confidence,
            overall=overall,
        )

        return AnalysisResult(
            scanned=scanned,
            document_type=document_type,
            topic=topic,
            version_status=version_status,
            proposed_name=proposed_name,
            proposed_full_name=proposed_full_name,
            confidence=confidence,
            warnings=warnings,
        )

    working_text = normalize_text(scanned.current_name)

    doc_match = match_document_type(
        working_text,
        config.document_types,
        config.document_type_aliases,
    )
    document_type = doc_match.canonical if doc_match else ""
    doc_confidence = doc_match.confidence if doc_match else 0.0

    if doc_match:
        working_text = remove_document_type(working_text, doc_match.matched_text)

    vs_match = match_version_status(scanned.current_name, config.version_status_keywords)
    version_status = vs_match.value if vs_match else ""
    vs_confidence = vs_match.confidence if vs_match else 0.0

    if vs_match:
        working_text = remove_version_status(working_text, vs_match.matched_text)

    topic, topic_confidence = extract_topic(
        working_text,
        scanned.folder_name if config.naming.separator not in scanned.current_name else "",
        config.noise_words,
    )

    if not document_type:
        warnings.append("no_document_type_detected")
        doc_confidence = 0.2
    if not topic:
        warnings.append("no_topic_detected")
        topic_confidence = 0.2
    if not version_status:
        vs_confidence = 0.0

    proposed_name = build_proposed_name(
        topic,
        document_type,
        version_status,
        config.naming.separator,
    )
    proposed_full_name = build_proposed_full_name(proposed_name, scanned.extension)

    if not proposed_name:
        warnings.append("empty_proposed_name")
        proposed_full_name = scanned.current_name + scanned.extension

    overall = _overall_confidence(doc_confidence, topic_confidence, vs_confidence)
    if overall < 0.5:
        warnings.append("low_confidence")

    confidence = ConfidenceScores(
        topic=topic_confidence,
        document_type=doc_confidence,
        version_status=vs_confidence,
        overall=overall,
    )

    return AnalysisResult(
        scanned=scanned,
        document_type=document_type,
        topic=topic,
        version_status=version_status,
        proposed_name=proposed_name,
        proposed_full_name=proposed_full_name,
        confidence=confidence,
        warnings=warnings,
    )


def _overall_confidence(
    doc_confidence: float,
    topic_confidence: float,
    vs_confidence: float,
) -> float:
    # Version/status is optional; weight topic and doc type more
    if vs_confidence > 0:
        return (doc_confidence * 0.35 + topic_confidence * 0.45 + vs_confidence * 0.2)
    return (doc_confidence * 0.4 + topic_confidence * 0.6)
