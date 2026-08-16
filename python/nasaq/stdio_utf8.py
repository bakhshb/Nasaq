"""Force UTF-8 on stdio for the JSON-RPC sidecar (especially on Windows)."""

from __future__ import annotations

import io
import os
import sys


def configure_stdio_utf8() -> None:
    """Ensure stdin/stdout use UTF-8 regardless of process locale."""
    os.environ.setdefault("PYTHONUTF8", "1")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    for stream in (sys.stdin, sys.stdout):
        if stream is None:
            continue
        try:
            stream.reconfigure(encoding="utf-8", errors="strict")
        except (AttributeError, io.UnsupportedOperation, ValueError):
            pass
