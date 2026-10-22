"""
Download YOLOX-Tiny ONNX weights (Apache 2.0) for local Eco-Scorer inference.

Run from the project root:
    python scripts/download_cv_model.py
"""
from __future__ import annotations

import sys
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / "computer_vision" / "models" / "yolox_tiny.onnx"
TEMP = DEST.with_suffix(".onnx.download")
URL = "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_tiny.onnx"
EXPECTED_SIZE = 20_219_662


def main() -> int:
    DEST.parent.mkdir(parents=True, exist_ok=True)
    if DEST.exists() and DEST.stat().st_size == EXPECTED_SIZE:
        print(f"Model already present: {DEST}")
        return 0
    print(f"Downloading YOLOX-Tiny (Apache 2.0) from:\n  {URL}")
    try:
        request = urllib.request.Request(URL, headers={"User-Agent": "EcoPath-AI-local-model-setup"})
        with urllib.request.urlopen(request, timeout=60) as response:
            final_host = urlparse(response.geturl()).hostname
            if final_host not in {"github.com", "release-assets.githubusercontent.com"}:
                raise ValueError(f"Unexpected model download host: {final_host}")
            content_length = response.headers.get("Content-Length")
            if content_length and int(content_length) != EXPECTED_SIZE:
                raise ValueError(f"Unexpected model size: {content_length} bytes")
            downloaded = 0
            with TEMP.open("wb") as model_file:
                while chunk := response.read(1024 * 1024):
                    downloaded += len(chunk)
                    if downloaded > EXPECTED_SIZE:
                        raise ValueError("Downloaded model exceeds its expected size.")
                    model_file.write(chunk)
        if downloaded != EXPECTED_SIZE:
            raise ValueError(f"Incomplete model download: received {downloaded} bytes.")
        TEMP.replace(DEST)
    except Exception as exc:
        TEMP.unlink(missing_ok=True)
        print(f"Download failed: {exc}")
        print("Place yolox_tiny.onnx manually at computer_vision/models/yolox_tiny.onnx")
        return 1
    print(f"Saved {DEST} ({DEST.stat().st_size} bytes)")
    print("Licence: Apache 2.0 — Megvii-BaseDetection/YOLOX")
    return 0


if __name__ == "__main__":
    sys.exit(main())
