#!/usr/bin/env python3
"""Build or verify the downloadable Jakuplayer Chrome/Edge extension."""

from __future__ import annotations

import argparse
import io
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "extension"
OUTPUT = ROOT / "jakuplayer-adblock.zip"
FILES = [
    "manifest.json",
    "content.js",
    "rules.json",
    "popup.html",
    "popup.css",
    "README.md",
    "icons/16.png",
    "icons/32.png",
    "icons/48.png",
    "icons/128.png",
]


def build_archive() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for relative in FILES:
            source = SOURCE / relative
            if not source.is_file():
                raise FileNotFoundError(f"Missing extension file: {source}")
            info = zipfile.ZipInfo(f"jakuplayer-adblock/{relative}", date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            archive.writestr(info, source.read_bytes())
    return buffer.getvalue()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if the committed ZIP is stale")
    args = parser.parse_args()
    expected = build_archive()

    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_bytes() != expected:
            raise SystemExit("jakuplayer-adblock.zip is stale; run: npm run package:extension")
        print("Extension ZIP is up to date.")
        return

    OUTPUT.write_bytes(expected)
    print(f"Built {OUTPUT.name} ({len(expected)} bytes).")


if __name__ == "__main__":
    main()
