"""Data models for Nasaq filename analysis."""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional


@dataclass
class ConfidenceScores:
    topic: float = 0.0
    document_type: float = 0.0
    version_status: float = 0.0
    overall: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return asdict(self)


@dataclass
class ScanConfig:
    recursive: bool = False
    extensions: List[str] = field(default_factory=lambda: ["*"])


@dataclass
class NamingConfig:
    separator: str = " - "
    qualifier_optional: bool = True


@dataclass
class AppConfig:
    document_types: List[str] = field(default_factory=list)
    document_type_aliases: Dict[str, str] = field(default_factory=dict)
    version_status_keywords: List[str] = field(default_factory=list)
    noise_words: List[str] = field(default_factory=list)
    scan: ScanConfig = field(default_factory=ScanConfig)
    naming: NamingConfig = field(default_factory=NamingConfig)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "documentTypes": self.document_types,
            "documentTypeAliases": self.document_type_aliases,
            "versionStatusKeywords": self.version_status_keywords,
            "noiseWords": self.noise_words,
            "scan": {
                "recursive": self.scan.recursive,
                "extensions": self.scan.extensions,
            },
            "naming": {
                "separator": self.naming.separator,
                "qualifierOptional": self.naming.qualifier_optional,
            },
        }

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> AppConfig:
        scan_data = data.get("scan", {})
        naming_data = data.get("naming", {})
        return AppConfig(
            document_types=list(data.get("documentTypes", [])),
            document_type_aliases=dict(data.get("documentTypeAliases", {})),
            version_status_keywords=list(data.get("versionStatusKeywords", [])),
            noise_words=list(data.get("noiseWords", [])),
            scan=ScanConfig(
                recursive=bool(scan_data.get("recursive", False)),
                extensions=list(scan_data.get("extensions", ["*"])),
            ),
            naming=NamingConfig(
                separator=str(naming_data.get("separator", " - ")),
                qualifier_optional=bool(naming_data.get("qualifierOptional", True)),
            ),
        )


@dataclass
class ScannedFile:
    id: str
    absolute_path: str
    relative_path: str
    extension: str
    current_name: str
    folder_name: str
    size_bytes: int = 0
    modified_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "absolutePath": self.absolute_path,
            "relativePath": self.relative_path,
            "extension": self.extension,
            "currentName": self.current_name,
            "folderName": self.folder_name,
            "sizeBytes": self.size_bytes,
            "modifiedAt": self.modified_at,
        }


@dataclass
class AnalysisResult:
    scanned: ScannedFile
    document_type: str = ""
    topic: str = ""
    version_status: str = ""
    proposed_name: str = ""
    proposed_full_name: str = ""
    confidence: ConfidenceScores = field(default_factory=ConfidenceScores)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.scanned.id,
            "absolutePath": self.scanned.absolute_path,
            "relativePath": self.scanned.relative_path,
            "extension": self.scanned.extension,
            "currentName": self.scanned.current_name,
            "folderName": self.scanned.folder_name,
            "documentType": self.document_type,
            "topic": self.topic,
            "versionStatus": self.version_status,
            "proposedName": self.proposed_name,
            "proposedFullName": self.proposed_full_name,
            "confidence": self.confidence.to_dict(),
            "warnings": list(self.warnings),
        }


@dataclass
class ValidationIssue:
    file_id: str
    code: str
    message: str

    def to_dict(self) -> Dict[str, str]:
        return {
            "fileId": self.file_id,
            "code": self.code,
            "message": self.message,
        }


@dataclass
class BatchProposal:
    file_id: str
    proposed_name: str = ""
    proposed_full_name: Optional[str] = None

    @staticmethod
    def from_dict(data: Dict[str, Any]) -> BatchProposal:
        return BatchProposal(
            file_id=str(data.get("fileId", "")),
            proposed_name=str(data.get("proposedName", "")),
            proposed_full_name=data.get("proposedFullName"),
        )
