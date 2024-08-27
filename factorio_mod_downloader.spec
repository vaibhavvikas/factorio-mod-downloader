# -*- mode: python ; coding: utf-8 -*-
import sys
import os
from PyInstaller.utils.hooks import copy_metadata

block_cipher = None

def get_files_in_directory(directory):
    for root, dirs, files in os.walk(directory):
        for file in files:
            yield os.path.join(root, file), os.path.relpath(root, directory)

datas = []
datas.extend(get_files_in_directory('gui'))
datas.extend(get_files_in_directory('mod_downloader'))


a = Analysis(
    ['gui\\gui.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=['tkinter',
                    'selenium'
                    'selenium.webdriver.common.by',
                    'selenium.webdriver.common.keys',
                    'selenium.webdriver.chrome.service',
                    'selenium.webdriver.remote.remote_connection',
                    'chromedriver_autoinstaller',
                    'bs4',
                    'bs4.element',
                    'bs4.builder',
                    'requests'
                    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='factorio_mod_downloader',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    excludes=[],
    cipher=block_cipher,
    noarchive=False,
    name='factorio_mod_downloader'
)
