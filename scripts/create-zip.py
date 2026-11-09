#!/usr/bin/env python3
"""Create a ZIP whose entries are rooted at the supplied staging directory."""

import sys
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: create-zip.py STAGING_DIR OUTPUT_ZIP")
    staging = Path(sys.argv[1])
    output = Path(sys.argv[2])
    if not staging.is_dir():
        raise SystemExit(f"staging directory not found: {staging}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as archive:
        for file in sorted(staging.rglob("*")):
            if file.is_file():
                archive.write(file, file.relative_to(staging))


if __name__ == "__main__":
    main()
