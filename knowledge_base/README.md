# EcoTwin AI — Knowledge Base

## Overview
Internal sustainability guidance articles, recommendation rules, calculation factors, and Eco-Scorer's supported object-to-guidance mappings. Articles support contextual recommendations and are not exposed as a separate browsing page. Eco-Scorer does not calculate an environmental score from object appearance.

## Structure

```
knowledge_base/
├── articles/               # Sustainability articles (JSON)
├── recommendation_rules/   # Rule definitions
├── calculation_factors/    # Emission factors and conversion rates
├── eco_scoring_rules/      # CV detection to sustainability mapping
├── sources/                # Source reference metadata
└── schemas/                # JSON schemas for validation
```

## Article Format

Each article is stored as JSON with these fields:
- `id`: Unique identifier (e.g., "kb-001")
- `title`: Article title
- `category`: One of: home-energy, food-kitchen, travel-transport, water-nature, shopping-products, waste-circular, business, visual-assessment
- `summary`: Brief summary
- `content`: Full article text
- `audience`: List of target audiences
- `implementation_steps`: Ordered list of actionable steps
- `limitations`: Known limitations
- `source_title`, `source_publisher`, `source_url`: Reference information
- `verification_status`: "verified", "unverified", or "needs-review"
- `tags`: Search keywords

## Principles

1. Cite a real, verifiable source for externally sourced factual claims.
2. Mark internally authored measurement guidance as `needs-review`; do not present it as an external source.
3. Do not invent statistics, savings, emissions, or endorsements.
4. Clearly label demonstration data.
5. Include limitations and caveats.
6. Implementation steps must be actionable and safe.
