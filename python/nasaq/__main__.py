"""Entry point for Nasaq Python sidecar."""

from __future__ import annotations

from nasaq.rpc import RpcServer
from nasaq.stdio_utf8 import configure_stdio_utf8


def main() -> None:
    configure_stdio_utf8()
    RpcServer().run()


if __name__ == "__main__":
    main()
