# EcoTwin AI — Testing Guide

## Backend Tests

### Setup
```bash
cd backend
pip install pytest httpx
```

### Running Tests
```bash
# Run all tests (start backend server first for API tests)
python -m pytest tests/ -v

# Run only calculation tests (no server required)
python -m pytest tests/test_calculations.py -v

# Run only recommendation engine tests (no server required)
python -m pytest tests/test_recommendation_engine.py -v

# Run Eco-Scorer validation, detector, assessment, KB, and planner tests (no server required)
python -m pytest tests/test_eco_scorer.py -v

# Run API integration tests (requires server on port 8000)
python -m uvicorn app.main:app --port 8000 &
python -m pytest tests/test_api.py -v
```

### Test Categories

| File | Tests | Server Required |
|------|-------|----------------|
| `test_calculations.py` | 18 tests — energy, transport, food formulas | No |
| `test_recommendation_engine.py` | 11 tests — rule triggers, priority, determinism | No |
| `test_eco_scorer.py` | Image validation, detector post-processing, evidence-only assessment, KB retrieval, planner actions, upload API | No |
| `test_api.py` | 9 tests — HTTP endpoints, responses | Yes |

### What Tests Verify

**Calculation Tests:**
- Correct formula outputs for known inputs
- Input validation (negative values, out-of-range)
- Determinism (same input → same output)
- Presence of required metadata (formula, assumptions)
- Edge cases (zero values, no savings scenarios)

**Recommendation Engine Tests:**
- Rules trigger on appropriate context conditions
- Rules skip when conditions are not met
- Results sorted by priority score
- Goals increase priority scores
- Empty context still returns fallback recommendations
- All required fields are present in results

**API Tests:**
- Health check returns correct status
- Workspace list and detail endpoints
- Recommendation generation with various inputs
- Comparison calculations for different scenarios
- Report generation

## Frontend Testing

Frontend components can be tested with Vitest (configured in Vite). To add:
```bash
cd frontend
npm install -D vitest @testing-library/react @testing-library/jest-dom
```
