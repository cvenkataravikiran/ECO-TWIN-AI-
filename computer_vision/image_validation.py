"""Bounded validation and normalization for uploaded raster images."""
from __future__ import annotations

import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError


CONTENT_TYPE_FORMATS = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}
MAX_DECODED_PIXELS = 40_000_000


class InvalidImage(ValueError):
    """An upload is not a supported, safely decodable image."""


def validate_image(
    contents: bytes,
    content_type: str,
    max_bytes: int,
    max_dimension: int,
) -> Image.Image:
    if not contents:
        raise InvalidImage("The uploaded file is empty.")
    if len(contents) > max_bytes:
        raise InvalidImage(f"Image exceeds the {max_bytes // (1024 * 1024)} MB upload limit.")
    expected_format = CONTENT_TYPE_FORMATS.get(content_type.lower().split(";")[0].strip())
    if expected_format is None:
        raise InvalidImage("Use a JPEG, PNG, or WebP image.")

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(contents)) as probe:
                if probe.format != expected_format:
                    raise InvalidImage("The file contents do not match the declared image type.")
                width, height = probe.size
                if width < 1 or height < 1 or width * height > MAX_DECODED_PIXELS:
                    raise InvalidImage("Image dimensions are invalid or exceed the safe decoding limit.")
                probe.verify()
            with Image.open(io.BytesIO(contents)) as source:
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGB")
    except InvalidImage:
        raise
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, Image.DecompressionBombWarning, ValueError) as exc:
        raise InvalidImage("The uploaded file is not a valid supported image.") from exc

    if max_dimension < 1:
        raise ValueError("max_dimension must be positive")
    if max(image.size) > max_dimension:
        image.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
    return image
