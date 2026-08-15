# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for the Nasaq analysis sidecar."""

block_cipher = None

a = Analysis(
    ["nasaq/__main__.py"],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[
        "nasaq",
        "nasaq.rpc",
        "nasaq.config",
        "nasaq.models",
        "nasaq.scanner",
        "nasaq.validators",
        "nasaq.naming",
        "nasaq.naming.engine",
        "nasaq.naming.normalize",
        "nasaq.naming.doc_type",
        "nasaq.naming.version_status",
        "nasaq.naming.topic",
        "nasaq.naming.builder",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="nasaq-engine",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
