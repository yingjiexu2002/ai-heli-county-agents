# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['app.py'],
    pathex=[],
    binaries=[],
    datas=[
        ('static', 'static'),
        ('data', 'data'),
        ('cert.pem', '.'),
        ('key.pem', '.'),
    ],
    hiddenimports=[
        # PyCryptodome components used for AES and padding
        'Crypto', 'Crypto.Cipher', 'Crypto.Cipher.AES', 'Crypto.Util.Padding', 'Crypto.Hash.MD5',
        # PyJWT algorithm backends
        'jwt', 'jwt.algorithms',
        # Flask CORS
        'flask_cors',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=['rth_startup_log.py'],
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
    name='爱河狸地图管理系统',
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