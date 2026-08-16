"""Tests for UTF-8 stdio configuration."""

from __future__ import annotations

import io

from nasaq.stdio_utf8 import configure_stdio_utf8


def test_configure_stdio_utf8_sets_env(monkeypatch):
    monkeypatch.delenv("PYTHONUTF8", raising=False)
    monkeypatch.delenv("PYTHONIOENCODING", raising=False)

    configure_stdio_utf8()

    import os

    assert os.environ["PYTHONUTF8"] == "1"
    assert os.environ["PYTHONIOENCODING"] == "utf-8"


def test_configure_stdio_utf8_reconfigures_streams(monkeypatch):
    fake_stdin = io.StringIO()
    fake_stdout = io.StringIO()

    class FakeStream:
        def reconfigure(self, *, encoding: str, errors: str) -> None:
            self.encoding = encoding
            self.errors = errors

    fake_stdin_obj = FakeStream()
    fake_stdout_obj = FakeStream()
    monkeypatch.setattr("nasaq.stdio_utf8.sys.stdin", fake_stdin_obj)
    monkeypatch.setattr("nasaq.stdio_utf8.sys.stdout", fake_stdout_obj)

    configure_stdio_utf8()

    assert fake_stdin_obj.encoding == "utf-8"
    assert fake_stdout_obj.encoding == "utf-8"
