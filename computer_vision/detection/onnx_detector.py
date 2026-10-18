"""
Local ONNX object detection (YOLOX-Tiny or YOLO-like tensors).

Licence of YOLOX-Tiny weights: Apache 2.0 (Megvii-BaseDetection).
This wrapper does not call any paid inference API.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from PIL import Image

from computer_vision.coco_classes import COCO_CLASSES


@dataclass
class Detection:
    class_label: str
    class_id: int
    confidence: float
    bbox: dict  # x,y,w,h in percent of image


class ModelNotAvailable(RuntimeError):
    pass


class InferenceError(RuntimeError):
    pass


def _letterbox(image: Image.Image, size: int = 416) -> Tuple[np.ndarray, float, int, int]:
    img = image.convert("RGB")
    w, h = img.size
    scale = min(size / w, size / h)
    nw, nh = int(w * scale), int(h * scale)
    resized = img.resize((nw, nh), Image.BILINEAR)
    canvas = Image.new("RGB", (size, size), (114, 114, 114))
    pad_x = (size - nw) // 2
    pad_y = (size - nh) // 2
    canvas.paste(resized, (pad_x, pad_y))
    arr = np.asarray(canvas, dtype=np.float32)
    chw = np.transpose(arr, (2, 0, 1))
    return np.expand_dims(chw, 0), scale, pad_x, pad_y


def _nms(
    boxes: np.ndarray,
    scores: np.ndarray,
    iou_threshold: float = 0.45,
    class_ids: Optional[np.ndarray] = None,
) -> List[int]:
    if len(boxes) == 0:
        return []
    x1, y1, x2, y2 = boxes[:, 0], boxes[:, 1], boxes[:, 2], boxes[:, 3]
    areas = np.maximum(0, x2 - x1) * np.maximum(0, y2 - y1)
    order = scores.argsort()[::-1]
    keep: List[int] = []
    while order.size > 0:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        xx1 = np.maximum(x1[i], x1[order[1:]])
        yy1 = np.maximum(y1[i], y1[order[1:]])
        xx2 = np.minimum(x2[i], x2[order[1:]])
        yy2 = np.minimum(y2[i], y2[order[1:]])
        inter = np.maximum(0, xx2 - xx1) * np.maximum(0, yy2 - yy1)
        iou = inter / (areas[i] + areas[order[1:]] - inter + 1e-9)
        remaining = order[1:]
        suppressed = iou > iou_threshold
        if class_ids is not None:
            suppressed &= class_ids[remaining] == class_ids[i]
        order = remaining[~suppressed]
    return keep


def _decode_yolox(output: np.ndarray, input_size: int = 416) -> np.ndarray:
    """Decode YOLOX head [1, n, 85] or [n, 85] into corner boxes + obj * cls."""
    pred = output[0] if output.ndim == 3 else output
    if pred.shape[-1] != 85:
        raise InferenceError(f"Unexpected model output last-dim {pred.shape}")
    grids = []
    expanded_strides = []
    hsize, wsize = input_size, input_size
    for stride in (8, 16, 32):
        hy, wy = hsize // stride, wsize // stride
        yv, xv = np.meshgrid(np.arange(hy), np.arange(wy), indexing="ij")
        grid = np.stack((xv, yv), axis=2).reshape(-1, 2)
        grids.append(grid)
        expanded_strides.append(np.full((grid.shape[0], 1), stride))
    grids_cat = np.concatenate(grids, 0)
    strides = np.concatenate(expanded_strides, 0)
    if pred.shape[0] != grids_cat.shape[0]:
        # Not a YOLOX raw head — treat as already decoded xywh + obj + cls
        return pred
    pred = pred.copy()
    pred[:, :2] = (pred[:, :2] + grids_cat) * strides
    pred[:, 2:4] = np.exp(pred[:, 2:4]) * strides
    return pred


class OnnxDetector:
    def __init__(self, model_path: str, confidence: float = 0.35, input_size: int = 416):
        self.model_path = Path(model_path)
        self.confidence = confidence
        self.input_size = input_size
        self._session = None

    def available(self) -> bool:
        return self.model_path.is_file()

    def _session_ort(self):
        if self._session is not None:
            return self._session
        if not self.available():
            raise ModelNotAvailable(
                f"No local model at {self.model_path}. Run: python scripts/download_cv_model.py"
            )
        try:
            import onnxruntime as ort
        except (ImportError, OSError) as exc:
            raise ModelNotAvailable(
                "onnxruntime is not installed. pip install onnxruntime Pillow numpy"
            ) from exc
        try:
            self._session = ort.InferenceSession(str(self.model_path), providers=["CPUExecutionProvider"])
        except Exception as exc:
            raise ModelNotAvailable(
                f"The local model at {self.model_path} could not be loaded. "
                "Verify the model file and download it again if necessary."
            ) from exc
        return self._session

    def detect_bytes(self, image_bytes: bytes) -> List[Detection]:
        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:
            raise InferenceError("Could not read the uploaded image.") from exc
        return self.detect_image(image)

    def detect_image(self, image: Image.Image) -> List[Detection]:
        session = self._session_ort()
        orig_w, orig_h = image.size
        blob, scale, pad_x, pad_y = _letterbox(image, self.input_size)
        input_name = session.get_inputs()[0].name
        try:
            outputs = session.run(None, {input_name: blob})
        except Exception as exc:
            raise InferenceError(f"ONNX inference failed: {exc}") from exc

        if not outputs:
            raise InferenceError("The ONNX model returned no detection output.")
        pred = outputs[0]
        decoded = _decode_yolox(np.array(pred), self.input_size)
        if decoded.ndim != 2 or decoded.shape[-1] != 85:
            raise InferenceError(f"Unexpected model output shape: {decoded.shape}")
        boxes_xywh = decoded[:, :4]
        obj = decoded[:, 4]
        cls_scores = decoded[:, 5:]
        cls_ids = cls_scores.argmax(1)
        cls_conf = cls_scores.max(1)
        scores = obj * cls_conf
        mask = scores >= self.confidence
        boxes_xywh = boxes_xywh[mask]
        scores = scores[mask]
        cls_ids = cls_ids[mask]
        if len(scores) == 0:
            return []

        x = boxes_xywh[:, 0]
        y = boxes_xywh[:, 1]
        w = boxes_xywh[:, 2]
        h = boxes_xywh[:, 3]
        boxes = np.stack([x - w / 2, y - h / 2, x + w / 2, y + h / 2], axis=1)
        keep = _nms(boxes, scores, class_ids=cls_ids)
        detections: List[Detection] = []
        for idx in keep:
            x1, y1, x2, y2 = boxes[idx]
            x1 = (x1 - pad_x) / scale
            x2 = (x2 - pad_x) / scale
            y1 = (y1 - pad_y) / scale
            y2 = (y2 - pad_y) / scale
            x1 = float(np.clip(x1, 0, orig_w))
            x2 = float(np.clip(x2, 0, orig_w))
            y1 = float(np.clip(y1, 0, orig_h))
            y2 = float(np.clip(y2, 0, orig_h))
            bw, bh = x2 - x1, y2 - y1
            if bw < 2 or bh < 2:
                continue
            cid = int(cls_ids[idx])
            label = COCO_CLASSES[cid] if 0 <= cid < len(COCO_CLASSES) else f"class-{cid}"
            detections.append(
                Detection(
                    class_label=label,
                    class_id=cid,
                    confidence=float(scores[idx]),
                    bbox={
                        "x": round(100 * x1 / orig_w, 2),
                        "y": round(100 * y1 / orig_h, 2),
                        "w": round(100 * bw / orig_w, 2),
                        "h": round(100 * bh / orig_h, 2),
                    },
                )
            )
        return detections
