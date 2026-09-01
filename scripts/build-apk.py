#!/usr/bin/env python3
"""Patch the Capacitor Android project and assemble a signed release APK."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID = ROOT / "android"
APP = ANDROID / "app"
MANIFEST = APP / "src" / "main" / "AndroidManifest.xml"
APP_GRADLE = APP / "build.gradle"
SIGNING = ROOT / "android-signing"


def version_code(ver: str) -> int:
    parts = [int(p) for p in ver.split(".")[:3]]
    while len(parts) < 3:
        parts.append(0)
    major, minor, patch = parts
    return major * 10000 + minor * 100 + patch


def patch_manifest() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    if "android.hardware.touchscreen" not in text:
        text = text.replace(
            "</manifest>",
            '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n</manifest>',
        )
    if "screenOrientation" in text:
        text = re.sub(
            r'android:screenOrientation="[^"]*"',
            'android:screenOrientation="fullUser"',
            text,
        )
    else:
        text = text.replace(
            "<activity",
            '<activity android:screenOrientation="fullUser"',
            1,
        )
    MANIFEST.write_text(text, encoding="utf-8")


def patch_styles() -> None:
    extra = """
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>
        <item name="android:windowOptOutEdgeToEdgeEnforcement">true</item>
"""
    res = APP / "src" / "main" / "res"
    for path in res.rglob("styles.xml"):
        text = path.read_text(encoding="utf-8")
        if "windowFullscreen" in text:
            continue
        text = text.replace("</style>", extra + "    </style>", 1)
        path.write_text(text, encoding="utf-8")


def patch_gradle(ver: str, code: int) -> None:
    text = APP_GRADLE.read_text(encoding="utf-8")
    text = re.sub(r"versionCode\s+\d+", f"versionCode {code}", text)
    text = re.sub(r'versionName\s+"[^"]+"', f'versionName "{ver}"', text)
    if "signingConfigs" not in text:
        signing = """
    signingConfigs {
        release {
            storeFile file("sunline.p12")
            storePassword "sunline-public"
            keyAlias "sunline"
            keyPassword "sunline-public"
        }
    }
"""
        text = text.replace("android {", "android {" + signing, 1)
        text = re.sub(
            r"(buildTypes\s*\{[\s\S]*?release\s*\{)",
            r"\1\n            signingConfig signingConfigs.release",
            text,
            count=1,
        )
    APP_GRADLE.write_text(text, encoding="utf-8")


def copy_icons() -> None:
    try:
        from PIL import Image
    except ImportError:
        print("Pillow missing; skipping density icons", flush=True)
        return
    src = ROOT / "build" / "icon.png"
    fg_path = ROOT / "build" / "icon-fg.png"
    bg_path = ROOT / "build" / "icon-bg.png"
    if not src.is_file():
        return
    master = Image.open(src).convert("RGBA")
    fg = Image.open(fg_path).convert("RGBA") if fg_path.is_file() else master
    bg = Image.open(bg_path).convert("RGB") if bg_path.is_file() else Image.new("RGB", (1024, 1024), (18, 24, 14))
    res = APP / "src" / "main" / "res"
    dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
    for name, d in dens.items():
        folder = res / f"mipmap-{name}"
        folder.mkdir(parents=True, exist_ok=True)
        launcher = master.resize((int(48 * d), int(48 * d)), Image.Resampling.LANCZOS)
        launcher.save(folder / "ic_launcher.png")
        launcher.save(folder / "ic_launcher_round.png")
        fg.resize((int(108 * d), int(108 * d)), Image.Resampling.LANCZOS).save(folder / "ic_launcher_foreground.png")
        bg.resize((int(108 * d), int(108 * d)), Image.Resampling.LANCZOS).save(folder / "ic_launcher_background.png")
    anydpi = res / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    xml = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""
    (anydpi / "ic_launcher.xml").write_text(xml, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(xml, encoding="utf-8")


def main() -> int:
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    ver = str(pkg["version"])
    code = version_code(ver)
    if not ANDROID.is_dir():
        raise SystemExit("android/ missing — run `npx cap add android` first")
    shutil.copy2(SIGNING / "sunline.p12", APP / "sunline.p12")
    patch_manifest()
    patch_styles()
    patch_gradle(ver, code)
    copy_icons()
    cmd = ["./gradlew", "assembleRelease", "--no-daemon"]
    print("running", " ".join(cmd), "version", ver, "code", code, flush=True)
    subprocess.check_call(cmd, cwd=ANDROID)
    apk_dir = APP / "build" / "outputs" / "apk" / "release"
    apks = list(apk_dir.glob("*.apk"))
    if not apks:
        raise SystemExit("no apk produced")
    out = ROOT / f"SunlineDefense-{ver}.apk"
    shutil.copy2(apks[0], out)
    print("wrote", out, "from", apks[0], flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
