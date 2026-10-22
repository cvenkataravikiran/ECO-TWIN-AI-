# EcoPath.AI — Development Log

## Stage 1 — Audit (16 October 2026)

**Done:** Inspected frontend, backend, knowledge_base, computer_vision, scripts, tests, docs.

**Works:** UI routes and design tokens; FastAPI app structure; SQLAlchemy models; energy/transport/food unit tests; recommendation-engine unit tests.

**Failed / incomplete:** Frontend never calls the API. Eco-Scorer is mocked on both sides. Knowledge base has no article files. Workspaces API ignores DB. Currency and sources are European. PDF reports are a timeout. CV model and onnxruntime are absent.

**Next:** Stage 2–6 implementation without discarding the existing UI.

## Eco-Scorer follow-up (17 October 2026)

Replaced the mock UI/API with optional local YOLOX-Tiny ONNX inference, bounded image validation, user-reviewed observations, private knowledge-base recommendations, and Action Planner integration. Added detector/scoring workflow tests and documented the limitations. The previous audit remains a record of the 16 October baseline; the Eco-Scorer findings in it are superseded by this implementation.

The numerical environmental score is intentionally withheld: COCO object presence does not establish lifecycle emissions, material composition, recyclability, or actual energy use. Install the local weights and inference dependencies to enable the navigation item. Other EcoPath.AI routes remain available when Eco-Scorer is disabled.
