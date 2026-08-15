"""Tests for JSON-RPC server."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

import pytest

from nasaq.config import ConfigStore, default_config
from nasaq.rpc import RpcServer


@pytest.fixture
def config_store(tmp_path):
    path = tmp_path / "config.json"
    store = ConfigStore(str(path))
    return store


@pytest.fixture
def server(config_store):
    return RpcServer(config_store)


def _call(server: RpcServer, method: str, params: dict | None = None, req_id: int = 1):
    return server.handle({"id": req_id, "method": method, "params": params or {}})


def test_ping(server):
    response = _call(server, "ping")
    assert response["result"] == {"ok": True}


def test_get_config(server):
    response = _call(server, "get_config")
    config = response["result"]
    assert "documentTypes" in config
    assert "بطاقة مبادرة" in config["documentTypes"]


def test_update_config(server):
    response = _call(
        server,
        "update_config",
        {"documentTypes": ["تقرير", "خطاب"]},
    )
    assert response["result"]["documentTypes"] == ["تقرير", "خطاب"]


def test_scan_and_analyze(server, tmp_path):
    work_dir = tmp_path / "work"
    work_dir.mkdir()
    sample = work_dir / "بطاقة المبادرة لمبادرة تقليص الظل مستلمة.xlsx"
    sample.write_text("data", encoding="utf-8")

    response = _call(server, "scan_and_analyze", {"rootPath": str(work_dir)})
    files = response["result"]["files"]
    assert len(files) == 1
    item = files[0]
    assert item["documentType"] == "بطاقة مبادرة"
    assert item["topic"] == "تقليص الظل"
    assert item["versionStatus"] == "مستلمة"


def test_validate_batch_rpc(server):
    response = _call(
        server,
        "validate_batch",
        {
            "rootPath": "/tmp",
            "proposals": [
                {"fileId": "1", "proposedFullName": "a - b - c.pdf"},
                {"fileId": "2", "proposedFullName": "a - b - c.pdf"},
            ],
        },
    )
    issues = response["result"]["issues"]
    assert any(issue["code"] == "duplicate_proposed_name" for issue in issues)


def test_unknown_method(server):
    response = _call(server, "not_a_method")
    assert response["error"]["code"] == "unknown_method"
