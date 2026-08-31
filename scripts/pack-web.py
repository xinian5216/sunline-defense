#!/usr/bin/env python3
"""Zip dist/ plus offline launchers for GitHub Releases."""
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
dist = root / "dist"
out = root / "SunlineDefense-web.zip"

readme = """阳光防线 离线网页包
================

不要双击 index.html（浏览器会拦截模块脚本）。

方式一：已安装 Python 3
  Windows：双击「打开游戏.bat」
  macOS / Linux：终端执行  ./打开游戏.sh
  然后浏览器打开 http://localhost:8080

方式二：已安装 Node.js
  npx --yes serve -p 8080
  打开 http://localhost:8080

更省事：去 Releases 下载对应系统的桌面版 exe / dmg / AppImage。
在线玩：https://xinian5216.github.io/sunline-defense/
"""

bat = r"""@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动本地服务器 http://localhost:8080
echo 保持此窗口开启，关闭即停止游戏。
where py >nul 2>nul && set PY=py && goto :run
where python >nul 2>nul && set PY=python && goto :run
echo 没有找到 Python。请安装 Python 3，或改用桌面版 exe。
pause
exit /b 1
:run
start "" http://localhost:8080
%PY% -m http.server 8080
"""

sh = """#!/bin/sh
cd "$(dirname "$0")"
echo "Starting http://localhost:8080"
(sleep 1; python3 -m webbrowser http://localhost:8080 >/dev/null 2>&1) &
python3 -m http.server 8080
"""

if not dist.is_dir():
    raise SystemExit("dist/ missing; run npm run build first")

with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as z:
    z.writestr("使用说明.txt", readme)
    z.writestr("打开游戏.bat", bat)
    z.writestr("打开游戏.sh", sh.replace("\r\n", "\n"))
    for p in dist.rglob("*"):
        if p.is_file():
            z.write(p, p.relative_to(dist).as_posix())

print(f"wrote {out} ({out.stat().st_size} bytes)")
