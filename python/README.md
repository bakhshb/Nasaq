# Nasaq Python Engine

Filename analysis sidecar for the Nasaq desktop application.

## Development

```bash
cd python
pip install -e ".[dev]"
pytest
python -m nasaq
```

## RPC

Line-delimited JSON requests/responses on stdin/stdout.

Methods: `ping`, `get_config`, `update_config`, `scan_and_analyze`, `validate_batch`.

## Standalone engine (PyInstaller)

From the repository root:

```bash
npm run build:python-engine
npm run test:engine
```

Output: `build/nasaq-engine/nasaq-engine` (Linux) or `nasaq-engine.exe` (Windows).

The Electron app bundles this binary via `electron-builder` extraResources — users do not need Python installed.

## Windows installer

On Windows (or CI):

```bash
npm run dist:win
```

Produces `release/Nasaq-0.1.0-Setup.exe` with the embedded analysis engine.
