"""Line-delimited JSON-RPC server for Nasaq."""

from __future__ import annotations

import json
import sys
import traceback
from typing import Any, Callable, Dict, Optional

from nasaq.approved_names import ApprovedNamesStore
from nasaq.config import ConfigStore
from nasaq.models import BatchProposal
from nasaq.naming.engine import analyze_file
from nasaq.scanner import scan_directory
from nasaq.stdio_utf8 import configure_stdio_utf8
from nasaq.validators import validate_batch


class RpcServer:
    def __init__(
        self,
        config_store: Optional[ConfigStore] = None,
        approved_names_store: Optional[ApprovedNamesStore] = None,
    ) -> None:
        self._config_store = config_store or ConfigStore()
        self._approved_names_store = approved_names_store or ApprovedNamesStore()
        self._handlers: Dict[str, Callable[[Any], Any]] = {
            "ping": self._ping,
            "get_config": self._get_config,
            "update_config": self._update_config,
            "scan_and_analyze": self._scan_and_analyze,
            "validate_batch": self._validate_batch,
            "save_approved_names": self._save_approved_names,
            "revert_approved_names": self._revert_approved_names,
        }

    def handle(self, request: Dict[str, Any]) -> Dict[str, Any]:
        req_id = request.get("id")
        method = request.get("method")
        params = request.get("params") or {}

        if not method:
            return self._error(req_id, "missing_method", "Request missing method.")

        handler = self._handlers.get(method)
        if not handler:
            return self._error(req_id, "unknown_method", f"Unknown method: {method}")

        try:
            result = handler(params)
            return {"id": req_id, "result": result}
        except ValueError as exc:
            return self._error(req_id, "invalid_params", str(exc))
        except Exception as exc:
            return self._error(req_id, "internal_error", str(exc), detail=traceback.format_exc())

    def run(self) -> None:
        configure_stdio_utf8()
        for line in sys.stdin:
            line = line.strip()
            if not line:
                continue
            try:
                request = json.loads(line)
            except json.JSONDecodeError as exc:
                response = self._error(None, "parse_error", str(exc))
            else:
                response = self.handle(request)
            sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
            sys.stdout.flush()

    def _ping(self, _params: Any) -> Dict[str, bool]:
        return {"ok": True}

    def _get_config(self, _params: Any) -> Dict[str, Any]:
        return self._config_store.get().to_dict()

    def _update_config(self, params: Any) -> Dict[str, Any]:
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        return self._config_store.update(params).to_dict()

    def _scan_and_analyze(self, params: Any) -> Dict[str, Any]:
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        root_path = params.get("rootPath")
        if not root_path:
            raise ValueError("rootPath is required")

        config = self._config_store.get()
        if "recursive" in params:
            config.scan.recursive = bool(params["recursive"])

        scanned = scan_directory(root_path, config)
        results = [
            self._approved_names_store.apply_to_result(analyze_file(item, config), config).to_dict()
            for item in scanned
        ]
        return {"files": results}

    def _save_approved_names(self, params: Any) -> Dict[str, Any]:
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        root_path = str(params.get("rootPath", "")).strip()
        items = params.get("items") or []
        if not isinstance(items, list):
            raise ValueError("items must be a list")
        count = self._approved_names_store.save_after_rename(root_path, items)
        return {"saved": count}

    def _revert_approved_names(self, params: Any) -> Dict[str, Any]:
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        moves = params.get("moves") or []
        if not isinstance(moves, list):
            raise ValueError("moves must be a list")
        count = self._approved_names_store.revert_after_undo(moves)
        return {"removed": count}

    def _validate_batch(self, params: Any) -> Dict[str, Any]:
        if not isinstance(params, dict):
            raise ValueError("params must be an object")
        root_path = params.get("rootPath")
        if not root_path:
            raise ValueError("rootPath is required")
        raw_proposals = params.get("proposals") or []
        if not isinstance(raw_proposals, list):
            raise ValueError("proposals must be a list")

        proposals = [BatchProposal.from_dict(item) for item in raw_proposals]
        existing_paths = params.get("existingPaths") or {}
        issues = validate_batch(root_path, proposals, existing_paths)
        return {"issues": [issue.to_dict() for issue in issues]}

    def _error(
        self,
        req_id: Any,
        code: str,
        message: str,
        detail: Optional[str] = None,
    ) -> Dict[str, Any]:
        error: Dict[str, Any] = {"code": code, "message": message}
        if detail:
            error["detail"] = detail
        return {"id": req_id, "error": error}
