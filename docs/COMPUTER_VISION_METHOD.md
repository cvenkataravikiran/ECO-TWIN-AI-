# Eco-Scorer computer-vision method

## Scope and model

Eco-Scorer uses the locally run YOLOX-Tiny ONNX object detector with COCO-trained weights (80 everyday object classes), distributed under Apache 2.0 by Megvii-BaseDetection. The model detects object labels and bounding boxes only. It has not been designed or validated to identify material composition, recyclability, BEE appliance ratings, energy efficiency, or environmental impact.

The detector uses CPU inference through ONNX Runtime. No generative AI, LLM, remote inference service, or paid AI API is used. The model weights are optional, are not committed to this repository, and can be installed from the project root:

```powershell
python scripts/download_cv_model.py
```

Install backend dependencies from `backend` with `pip install -r requirements.txt`. Until both the model and inference dependencies are present, the feature reports unavailable, its navigation link is hidden, and the analysis endpoint returns an error rather than fabricated detections.

## Input handling and privacy

1. The API accepts JPEG, PNG, and WebP only, and checks both the declared media type and decoded image format.
2. The request is read in bounded chunks and rejected above 10 MiB. Decompression-bomb-sized images are rejected; valid larger dimensions are resized to a maximum 1920-pixel side.
3. EXIF orientation is applied, then the image is resized/letterboxed for the detector.
4. The image is processed in memory by the configured EcoPath.AI backend and is not written to disk or retained. The assessment stores detections, confidence values, bounding boxes, review state, and model metadata, but not the image bytes or original filename.
5. Never upload sensitive documents or photos of people without their consent.

On mobile, selecting **Take a photo** opens the device's camera capture directly and requests the rear-facing camera where supported. The live browser-camera control is currently hidden in the interface; its implementation remains in place. When enabled, live camera access requires browser permission and a secure page (HTTPS or localhost). A captured image follows the same validation and processing path as a selected image.

## Detection and confidence

YOLOX-Tiny runs locally on CPU. The default threshold is 0.35 (`CV_CONFIDENCE_THRESHOLD`). Overlapping detections are filtered with non-maximum suppression. The displayed confidence is the model's object-detection score (`objectness × highest class score`); it is not a calibrated probability and does not represent confidence in any sustainability claim.

Supported labels are the detector's COCO classes. Sustainability guidance is available only for explicit mappings in `knowledge_base/eco_scoring_rules/coco_sustainability_map.json`. Unmapped classes remain unmapped. Users can confirm, correct, dismiss, or restore a detection. A corrected label receives guidance only if that label has a documented mapping.

## Assessment formula and recommendations

Eco-Scorer reports a **photo guidance summary**, not an Eco Score. It counts the distinct mapped guidance categories among active detections (detected, confirmed, or corrected); duplicate objects in the same category count once. Dismissed and unmapped observations do not contribute. This count only describes how many types of practical guidance the photo surfaced. It does not measure whether a scene is greener, environmental performance, emissions, or impact. A zero means no mapped guidance category was recognized, not that the scene is environmentally poor. The API keeps its legacy `score` and `max_score` fields as `null` for compatibility; clients must use `guidance_area_count` for this result.

The Environmental Evidence Profile keeps workspace resource records separate from image detections. It displays the latest saved record in each resource category with its original quantity, unit, period, source, and measurement type; values across periods or units are not added together. Emissions remain uncalculated unless applicable, verified emission factors and the required activity data are available. Recyclability remains unassessed because the detector cannot verify material composition or current local collection rules. The profile is evidence-oriented, not a composite score or comparison between workspaces.

The assessment also provides a Telangana action cue where a category supports one. For example, waste prompts users to check their own municipality's current instructions; it does not claim an item is recyclable or assert that a particular collection service is available. Hyderabad travel guidance is conditional on the actual route and safety. Object detection still cannot establish material, product condition, usage, lifecycle emissions, or environmental impact. The guidance count must not be used to compare people, homes, or businesses.

The displayed review coverage is:

```text
review coverage = (confirmed + corrected + dismissed detections) / all detections
```

This is only a progress measure for reviewing model output; it is not evidence of impact or model accuracy. With no detections it is zero. Detected labels with an explicit private-knowledge-base article mapping retrieve preliminary guidance immediately after analysis. The UI marks it as preliminary until the user confirms the object. Confirmed/corrected labels retain their article and limitations, and only confirmed/corrected observations can be saved to the existing Action Planner. No recommendation is returned for an unsupported label or absent article.

These suggestions are local object detection plus deterministic mapping to curated knowledge-base articles; no generative AI or remote AI service is used. Guidance may suggest conditional actions such as reuse, repair, or checking local recycling rules, but a photo alone cannot determine whether an item is harmful, reusable, recyclable, or environmentally preferable.

For confirmed labels explicitly mapped to the standby-power article (`kb-002`), Eco-Scorer may also show the existing deterministic `rec-002` estimate when the workspace has a measured electricity record in kWh covering the latest complete calendar month, with a consistent recorded currency and bill cost. The engine's documented standby fraction and shutoff assumptions produce an estimate from that separate workspace record; the photo provides no electricity measurement. The UI shows the period, baseline, formula, assumptions, confidence, and missing device-level data. Estimated, partial-month, unsupported-unit, or otherwise incomplete records do not trigger this calculation. The same basis and assumptions are carried into the saved Action Planner notes.

## Supported object-to-guidance mappings

Mappings are intentionally narrow and maintained with the scoring rules. Examples:

| Detected COCO label | Confirmation needed | Curated article |
|---|---|---|
| bottle, cup, cutlery | Reuse and material cannot be inferred from the image | Waste hierarchy and segregation (`kb-007`) |
| laptop, phone, furniture | Product condition, material, and actual use are not inferred | Repair before replace (`kb-005`); laptop and phone also retrieve standby-power guidance (`kb-002`) |
| refrigerator, TV, oven | Model, BEE label, and electricity use are not inferred | Efficient lighting and BEE appliance labels (`kb-001`); explicitly mapped display classes also retrieve standby-power guidance (`kb-002`) |
| car, bus, bicycle, train | Travel behaviour, trip distance, and emissions are not inferred | Comparing local trips (`kb-004`) |

The mapping can include a cautionary guidance prompt; it cannot establish that an item is sustainable or that an action will reduce emissions.

## Limitations

- COCO coverage is not a sustainability taxonomy; relevant objects may be absent, missed, or misclassified.
- A photo cannot reliably establish lifecycle emissions, actual electricity use, product composition, repairability, or recyclability in every location.
- Detector confidence is not a sustainability-confidence measure.
- User corrections are self-reported and are not verified by the model.
- A single viewpoint cannot represent a whole home, business, or product lifecycle.
- The knowledge-base articles provide general, sourced information and may have location-specific limitations.

## Tests

Run Eco-Scorer image validation, detector post-processing, and evidence-only assessment tests from `backend`:

```powershell
python -m pytest tests/test_eco_scorer.py -q
```
