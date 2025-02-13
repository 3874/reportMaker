# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['ffserver.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('templates', 'templates'),  # templates 폴더 포함
        ('static', 'static'), 
        ('setting', 'setting'),      # setting 폴더 포함
    ],
    hiddenimports=[
        'flask',
        'tinydb',
        'flask_cors',
        'bs4',
        'googleapiclient.discovery',
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
    name='FFserver',
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