# EcoPath.AI computer vision

Eco-Scorer uses a local YOLOX-Tiny ONNX detector for COCO object detection. It returns detected COCO labels, confidence scores, and bounding boxes; it does not detect material composition, recyclability, appliance efficiency, or environmental impact.

## Enable local inference

Install backend dependencies from `backend`:

```powershell
pip install -r requirements.txt
```

From the project root, download the Apache 2.0 model weights:

```powershell
python scripts/download_cv_model.py
```

The model is stored at `computer_vision/models/yolox_tiny.onnx` and is excluded from version control. Eco-Scorer remains optional; without weights or ONNX Runtime the API reports it unavailable and does not return simulated detections.

Image validation is in `image_validation.py`, ONNX inference and post-processing are in `detection/onnx_detector.py`, and action-opportunity scoring helpers are in `scoring/eco_score.py`. Object-to-guidance and knowledge-base article mappings live in `knowledge_base/eco_scoring_rules/coco_sustainability_map.json`.

The returned Telangana Green Action Score measures the mapped guidance opportunities a photo surfaces, not its environmental performance or impact. See the documented formula and limitations in [the method](../docs/COMPUTER_VISION_METHOD.md).

See [the documented method](../docs/COMPUTER_VISION_METHOD.md) for input limits, privacy handling, scoring/assessment formula, confidence interpretation, mapping scope, and limitations.

## Licence

YOLOX-Tiny: Apache 2.0 — Megvii-BaseDetection/YOLOX.
