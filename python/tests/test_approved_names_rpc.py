"""Tests for approved names RPC integration."""

from __future__ import annotations

from nasaq.approved_names import ApprovedNamesStore
from nasaq.config import ConfigStore
from nasaq.rpc import RpcServer


def _call(server: RpcServer, method: str, params: dict | None = None, req_id: int = 1):
    return server.handle({"id": req_id, "method": method, "params": params or {}})


def test_save_and_scan_applies_approved_names(tmp_path):
    config_path = tmp_path / "config.json"
    approved_path = tmp_path / "approved-names.json"
    work_dir = tmp_path / "work"
    work_dir.mkdir()

    filename = "مركز التفويج - عرض تقديمي - رد على فريق العمل الدائم.pptx"
    sample = work_dir / filename
    sample.write_text("data", encoding="utf-8")

    server = RpcServer(
        ConfigStore(str(config_path)),
        ApprovedNamesStore(str(approved_path)),
    )

    absolute_path = str(sample)
    save_response = _call(
        server,
        "save_approved_names",
        {
            "rootPath": str(work_dir),
            "items": [
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
        },
    )
    assert save_response["result"]["saved"] == 1

    scan_response = _call(server, "scan_and_analyze", {"rootPath": str(work_dir)})
    item = scan_response["result"]["files"][0]
    assert item["versionStatus"] == "رد على فريق العمل الدائم"
    assert item["proposedFullName"] == filename
    assert "approved_name_applied" in item["warnings"]
