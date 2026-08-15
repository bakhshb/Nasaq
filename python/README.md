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
