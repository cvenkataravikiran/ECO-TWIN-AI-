"""
EcoPath.AI — Recommendation Engine Tests
"""
import json
from pathlib import Path

import pytest
from app.recommendation_engine.engine import ACTIVE_RULES, UserContext, generate_recommendations


class TestGenerateRecommendations:
    def test_full_context_returns_multiple(self):
        ctx = UserContext(
            workspace_type="individual",
            monthly_electricity_kwh=268,
            monthly_grocery_spend=420,
            monthly_travel_km=480,
            travel_mode="car",
            price_per_kwh=0.15,
            goals=["reduce-costs", "reduce-emissions"],
        )
        results = generate_recommendations(ctx)
        assert len(results) >= 4

    def test_deterministic(self):
        ctx = UserContext(monthly_electricity_kwh=300, price_per_kwh=0.15)
        r1 = generate_recommendations(ctx)
        r2 = generate_recommendations(ctx)
        assert len(r1) == len(r2)
        for a, b in zip(r1, r2):
            assert a.id == b.id
            assert a.priority_score == b.priority_score

    def test_sorted_by_priority(self):
        ctx = UserContext(monthly_electricity_kwh=268, monthly_grocery_spend=420, goals=["reduce-costs"])
        results = generate_recommendations(ctx)
        scores = [r.priority_score for r in results]
        assert scores == sorted(scores, reverse=True)

    def test_led_triggers_on_high_electricity(self):
        ctx = UserContext(monthly_electricity_kwh=200, price_per_kwh=0.15)
        results = generate_recommendations(ctx)
        assert "rec-001" in [r.id for r in results]

    def test_led_skipped_on_low_electricity(self):
        ctx = UserContext(monthly_electricity_kwh=50, price_per_kwh=0.15)
        results = generate_recommendations(ctx)
        assert "rec-001" not in [r.id for r in results]

    def test_food_rule_triggers(self):
        ctx = UserContext(monthly_grocery_spend=420)
        results = generate_recommendations(ctx)
        assert "rec-003" in [r.id for r in results]

    def test_transport_for_car(self):
        ctx = UserContext(monthly_travel_km=480, travel_mode="car")
        results = generate_recommendations(ctx)
        assert "rec-004" in [r.id for r in results]

    def test_transport_skipped_for_cyclist(self):
        ctx = UserContext(monthly_travel_km=480, travel_mode="cycling")
        results = generate_recommendations(ctx)
        assert "rec-004" not in [r.id for r in results]

    def test_travel_mode_is_not_assumed_when_only_distance_is_known(self):
        results = generate_recommendations(UserContext(monthly_travel_km=480))
        ids = {result.id for result in results}
        assert "rec-004" not in ids
        assert "rec-012" in ids

    def test_empty_context_does_not_return_unsolicited_recommendations(self):
        assert generate_recommendations(UserContext()) == []

    def test_explicit_water_goal_can_recommend_measuring_water_without_a_baseline(self):
        results = generate_recommendations(UserContext(goals=["reduce-water"]))
        assert "rec-005" in [result.id for result in results]

    def test_goals_boost_priority(self):
        ctx_no = UserContext(monthly_electricity_kwh=268, price_per_kwh=0.15)
        ctx_yes = UserContext(monthly_electricity_kwh=268, price_per_kwh=0.15, goals=["reduce-costs", "reduce-emissions"])
        r_no = generate_recommendations(ctx_no)
        r_yes = generate_recommendations(ctx_yes)
        led_no = next(r for r in r_no if r.id == "rec-001")
        led_yes = next(r for r in r_yes if r.id == "rec-001")
        assert led_yes.priority_score > led_no.priority_score

    def test_required_fields_present(self):
        ctx = UserContext(monthly_electricity_kwh=268, monthly_grocery_spend=420)
        for r in generate_recommendations(ctx):
            assert r.title
            assert r.category
            assert r.formula_description
            assert isinstance(r.assumptions, list)
            assert isinstance(r.missing_data, list)
            assert r.confidence_level in ("high", "medium", "low", "insufficient")

    def test_recommendations_do_not_invent_savings_or_emissions(self):
        ctx = UserContext(
            monthly_electricity_kwh=268,
            monthly_travel_km=480,
            travel_mode="car",
            monthly_grocery_spend=420,
        )
        results = generate_recommendations(ctx)
        assert results
        assert all(result.estimated_monthly_savings is None for result in results)
        assert all(result.environmental_estimate is None for result in results)

    def test_expanded_rules_produce_only_relevant_article_linked_recommendations(self):
        context = UserContext(
            workspace_type="business",
            monthly_electricity_kwh=180,
            monthly_grocery_spend=12000,
            monthly_travel_km=480,
            travel_mode="car",
            monthly_water_liters=12000,
            monthly_waste_kg=35,
            monthly_shopping_spend=4000,
        )
        results = generate_recommendations(context)
        result_ids = {result.id for result in results}
        assert {f"rec-{number:03d}" for number in range(1, 16)} - {"rec-005"} <= result_ids
        assert len(ACTIVE_RULES) == 15

        root = Path(__file__).resolve().parents[2]
        article_ids = {
            json.loads(path.read_text(encoding="utf-8"))["id"]
            for path in (root / "knowledge_base" / "articles").glob("*.json")
        }
        assert all(result.knowledge_article_id in article_ids for result in results)
        assert all(result.estimated_monthly_savings is None for result in results)
        assert all(result.environmental_estimate is None for result in results)

    @pytest.mark.parametrize(
        ("context", "expected_ids", "expected_basis"),
        [
            (
                UserContext(monthly_electricity_kwh=80),
                {"rec-002", "rec-013"},
                "Electricity input: 80 kWh/month.",
            ),
            (
                UserContext(monthly_grocery_spend=420),
                {"rec-003", "rec-014"},
                "Grocery-spend input: ₹420/month.",
            ),
            (
                UserContext(monthly_water_liters=2500),
                {"rec-006", "rec-007"},
                "Water input: 2500 L/month.",
            ),
            (
                UserContext(monthly_waste_kg=12),
                {"rec-008", "rec-009"},
                "Waste input: 12.0 kg/month.",
            ),
            (
                UserContext(monthly_shopping_spend=1500),
                {"rec-010", "rec-011"},
                "Shopping input: ₹1500/month.",
            ),
            (
                UserContext(monthly_travel_km=120, travel_mode="car"),
                {"rec-004", "rec-012"},
                "Travel input: 120 km/month by car.",
            ),
        ],
    )
    def test_resource_inputs_produce_two_concise_actions_with_personalized_basis(
        self,
        context,
        expected_ids,
        expected_basis,
    ):
        recommendations = generate_recommendations(context)
        matching = [item for item in recommendations if item.id in expected_ids]

        assert {item.id for item in matching} == expected_ids
        assert all(item.next_step and len(item.next_step) < 150 for item in matching)
        assert all(item.input_basis == expected_basis for item in matching)

    def test_multiple_resource_categories_produce_category_specific_actions(self):
        recommendations = generate_recommendations(UserContext(
            monthly_electricity_kwh=180,
            monthly_water_liters=2500,
            monthly_waste_kg=12,
        ))

        assert {item.category for item in recommendations} >= {
            "home-energy",
            "water-nature",
            "waste-circular",
        }
        assert all(item.to_dict()["next_step"] == item.next_step for item in recommendations)
        assert all(item.to_dict()["input_basis"] == item.input_basis for item in recommendations)
