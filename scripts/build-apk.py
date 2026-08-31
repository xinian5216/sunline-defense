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
    if "android.permission.VIBRATE" not in text:
        text = text.replace(
            "</manifest>",
            '    <uses-feature android:name="android.hardware.touchscreen" android:required="false" />\n</manifest>',
        )
    text = re.sub(
        r'<activity([^>]*?)>',
        lambda m: m.group(0)
        if "screenOrientation" in m.group(1)
        else m.group(0).replace(
            "<activity",
            '<activity android:screenOrientation="sensorLandscape"',
            1,
        ),
        text,
        count=1,
    )
    MANIFEST.write_text(text, encoding="utf-8")


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
    src = ROOT / "build" / "icon.png"
    if not src.is_file():
        return
    res = APP / "src" / "main" / "res"
    for folder in ("mipmap-hdpi", "mipmap-mdpi", "mipmap-xhdpi", "mipmap-xxhdpi", "mipmap-xxxhdpi"):
        dest_dir = res / folder
        if not dest_dir.is_dir():
            continue
        for name in ("ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"):
            target = dest_dir / name
            if target.exists() or True:
                shutil.copy2(src, dest_dir / "ic_launcher.png")
                shutil.copy2(src, dest_dir / "ic_launcher_round.png")
                break


def main() -> int:
    pkg = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    ver = str(pkg["version"])
    code = version_code(ver)
    if not ANDROID.is_dir():
        raise SystemExit("android/ missing — run `npx cap add android` first")
    shutil.copy2(SIGNING / "sunline.p12", APP / "sunline.p12")
    patch_manifest()
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
