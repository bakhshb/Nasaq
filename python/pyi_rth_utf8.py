"""PyInstaller runtime hook: enable UTF-8 mode before the app starts."""

import os

os.environ.setdefault("PYTHONUTF8", "1")
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
