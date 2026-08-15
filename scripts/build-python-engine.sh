#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON_DIR="$ROOT/python"
VENV_PYTHON="$PYTHON_DIR/.venv/bin/python"
OUT_DIR="$ROOT/build/nasaq-engine"
WORK_DIR="$ROOT/build/pyinstaller-work"
SPEC_DIR="$ROOT/build/pyinstaller-spec"

if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "Python venv not found. Run: cd python && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'"
  exit 1
fi

"$VENV_PYTHON" -m pip install -q pyinstaller

mkdir -p "$OUT_DIR" "$WORK_DIR" "$SPEC_DIR"

"$VENV_PYTHON" -m PyInstaller \
  "$PYTHON_DIR/nasaq-engine.spec" \
  --noconfirm \
  --distpath "$OUT_DIR" \
  --workpath "$WORK_DIR" \
  --specpath "$SPEC_DIR"

if [[ -f "$OUT_DIR/nasaq-engine.exe" ]]; then
  echo "Built: $OUT_DIR/nasaq-engine.exe"
elif [[ -f "$OUT_DIR/nasaq-engine" ]]; then
  echo "Built: $OUT_DIR/nasaq-engine"
else
  echo "PyInstaller output not found in $OUT_DIR"
  exit 1
fi
