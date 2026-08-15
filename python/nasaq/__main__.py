"""Entry point for Nasaq Python sidecar."""

from __future__ import annotations

from nasaq.rpc import RpcServer


def main() -> None:
    RpcServer().run()


if __name__ == "__main__":
    main()
