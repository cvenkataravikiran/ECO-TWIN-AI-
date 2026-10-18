"""
EcoTwin AI — Seed Demo Data Script
Run only in a disposable presentation database:
ECOTWIN_ALLOW_DEMO_SEED=1 python scripts/seed_demo_data.py

Populates the database with sample data for demonstration.
All data is clearly labelled as sample/demo data.
"""
import sys
import os
import json
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.database import SessionLocal, init_db
from app.models.workspace import Workspace
from app.models.resource_record import ResourceRecord
from app.models.knowledge_article import KnowledgeArticle
from app.models.action_plan import Action


def seed_workspaces(db):
    """Create demo workspaces."""
    workspaces = [
        Workspace(
            id="ws-personal-001",
            name="My Household",
            type="individual",
            description="Personal household sustainability tracking",
            is_demo=True,
        ),
        Workspace(
            id="ws-business-001",
            name="Demonstration campus (Hyderabad)",
            type="business",
            description="DEMONSTRATION DATA — labelled college workspace for mentors. Not a live institution.",
            is_demo=True,
        ),
    ]
    for ws in workspaces:
        existing = db.query(Workspace).filter(Workspace.id == ws.id).first()
        if not existing:
            db.add(ws)
    db.commit()
    print(f"  ✓ {len(workspaces)} workspaces seeded")


def seed_resource_records(db):
    """Create sample resource consumption records."""
    records = [
        ResourceRecord(id="res-demo-001", workspace_id="ws-personal-001", category="electricity", description="September electricity bill", quantity=245, unit="kWh", cost=36.75, currency="EUR", period_start="2024-09-01", period_end="2024-09-30", measurement_type="measured", source="Utility bill September 2024"),
        ResourceRecord(id="res-demo-002", workspace_id="ws-personal-001", category="electricity", description="October electricity bill", quantity=268, unit="kWh", cost=40.20, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="measured", source="Utility bill October 2024"),
        ResourceRecord(id="res-demo-003", workspace_id="ws-personal-001", category="water", description="Monthly water usage", quantity=8.5, unit="m³", cost=29.75, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="measured", source="Water meter reading"),
        ResourceRecord(id="res-demo-004", workspace_id="ws-personal-001", category="gas", description="Gas heating October", quantity=45, unit="m³", cost=38.25, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="measured", source="Gas meter reading"),
        ResourceRecord(id="res-demo-005", workspace_id="ws-personal-001", category="travel", description="Commute fuel costs", quantity=480, unit="km", cost=67.20, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="estimated", source="Odometer estimate"),
        ResourceRecord(id="res-demo-006", workspace_id="ws-personal-001", category="food", description="Monthly grocery shopping", quantity=1, unit="month", cost=420.00, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="estimated", source="Bank statement summary"),
        ResourceRecord(id="res-demo-007", workspace_id="ws-personal-001", category="waste", description="General waste bin collections", quantity=4, unit="collections", cost=0, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="estimated", source="Visual estimate"),
        ResourceRecord(id="res-demo-008", workspace_id="ws-business-001", category="electricity", description="Building electricity September", quantity=4200, unit="kWh", cost=588.00, currency="EUR", period_start="2024-09-01", period_end="2024-09-30", measurement_type="measured", source="Facilities energy dashboard"),
        ResourceRecord(id="res-demo-009", workspace_id="ws-business-001", category="electricity", description="Building electricity October", quantity=4650, unit="kWh", cost=651.00, currency="EUR", period_start="2024-10-01", period_end="2024-10-31", measurement_type="measured", source="Facilities energy dashboard"),
    ]
    for r in records:
        existing = db.query(ResourceRecord).filter(ResourceRecord.id == r.id).first()
        if not existing:
            db.add(r)
    db.commit()
    print(f"  ✓ {len(records)} resource records seeded")


def seed_knowledge_articles(db):
    """Create sample knowledge base articles."""
    articles = [
        KnowledgeArticle(
            id="kb-001",
            title="LED Lighting: Energy Savings Guide",
            category="home-energy",
            summary="A practical guide to understanding LED lighting benefits, payback periods, and selection criteria for residential and commercial spaces.",
            content="LED (Light Emitting Diode) bulbs use approximately 75-85% less energy than traditional incandescent bulbs while lasting 15-25 times longer. A standard 60W incandescent bulb can be replaced by an 8-10W LED producing equivalent brightness (measured in lumens).\n\nFor a household with 10 frequently used light fixtures, switching from incandescent to LED can save approximately 600-800 kWh per year, depending on daily usage hours.\n\nKey factors to consider:\n- Colour temperature (warm white 2700K for living spaces, cool white 4000K for workspaces)\n- Lumens per watt (efficiency indicator)\n- Dimmability requirements\n- Bulb base compatibility (E27, E14, GU10, B22)",
            audience=json.dumps(["individual", "household", "business"]),
            implementation_steps=json.dumps([
                "Audit current light fixtures and note bulb types and wattages",
                "Count daily operating hours for each fixture",
                "Select LED replacements matching lumen output and base type",
                "Replace bulbs starting with most-used fixtures for fastest payback",
                "Dispose of old bulbs at local recycling collection point",
            ]),
            limitations=json.dumps([
                "Savings estimates assume consistent daily usage patterns",
                "Actual LED lifespan depends on operating temperature and switching frequency",
                "Some older dimmer switches are not compatible with LED bulbs",
            ]),
            source_title="Energy Saving Trust — LED Lighting",
            source_publisher="Energy Saving Trust",
            source_url="https://energysavingtrust.org.uk/advice/lighting/",
            publication_date="2024-03-15",
            last_verified_date="2024-09-01",
            verification_status="verified",
            tags=json.dumps(["lighting", "energy", "LED", "electricity", "savings"]),
        ),
        KnowledgeArticle(
            id="kb-002",
            title="Reducing Standby Power Consumption",
            category="home-energy",
            summary="How to identify and eliminate vampire power from idle electronics using switched power strips and smart plugs.",
            content="Standby power (also called vampire power or phantom load) is electricity consumed by devices that are plugged in but not actively in use. The International Energy Agency estimates standby consumption represents 5-10% of residential electricity use in most developed countries.\n\nCommon high-standby devices include: gaming consoles (5-15W), cable/satellite boxes (15-45W), older televisions (5-10W), desktop computers in sleep mode (2-5W), and phone/laptop chargers (0.1-0.5W).\n\nThe most effective reduction strategy is grouping related devices onto switched power strips and turning off the strip when devices are not in use.",
            audience=json.dumps(["individual", "household"]),
            implementation_steps=json.dumps([
                "Identify entertainment centres, home offices, and kitchen counter appliance clusters",
                "Purchase switched power strips with surge protection",
                "Group devices that can be fully shut off together",
                "Label each strip clearly so household members know which strip controls which devices",
                "Establish a routine of switching off strips before bed or leaving home",
            ]),
            limitations=json.dumps([
                "Some devices (routers, DVRs, medical equipment) must remain powered continuously",
                "Smart home devices require continuous power to function",
                "Exact standby draw requires a plug-level energy meter to measure",
            ]),
            source_title="IEA — Standby Power",
            source_publisher="International Energy Agency",
            source_url="https://www.iea.org/energy-system/buildings/standby-power",
            publication_date="2023-11-01",
            last_verified_date="2024-08-15",
            verification_status="verified",
            tags=json.dumps(["standby", "vampire-power", "electronics", "energy", "savings"]),
        ),
        KnowledgeArticle(
            id="kb-003",
            title="Reducing Household Food Waste",
            category="food-kitchen",
            summary="Practical strategies for meal planning, proper food storage, and creative leftover usage to reduce the estimated 25% of grocery spending that becomes waste.",
            content="Research by WRAP (Waste and Resources Action Programme) indicates that the average household throws away approximately 20-25% of purchased food. The primary causes are over-purchasing, improper storage leading to premature spoilage, and confusion about date labels.\n\nThe financial impact is significant: a household spending €400/month on groceries may waste €80-100/month in discarded food.\n\nEffective strategies include weekly meal planning before shopping, maintaining a running inventory of perishables, understanding the difference between 'use by' (safety) and 'best before' (quality) dates, and batch cooking with intentional leftover planning.",
            audience=json.dumps(["individual", "household"]),
            implementation_steps=json.dumps([
                "Conduct a one-week kitchen waste audit to establish baseline",
                "Plan meals for the week before creating a shopping list",
                "Check existing pantry and refrigerator before shopping",
                "Store perishables according to optimal temperature and humidity",
                "Designate one meal per week as a 'leftover remix' meal",
                "Compost unavoidable food waste where local facilities exist",
            ]),
            limitations=json.dumps([
                "The 25% waste estimate is a population average and varies significantly by household",
                "Cultural food practices and family composition affect waste patterns",
                "Individual tracking is needed for accurate household-specific estimates",
            ]),
            source_title="WRAP — Food Waste Reduction",
            source_publisher="WRAP",
            source_url="https://wrap.org.uk/taking-action/food-drink/actions/citizen-food-waste",
            publication_date="2024-01-20",
            last_verified_date="2024-07-10",
            verification_status="verified",
            tags=json.dumps(["food", "waste", "meal-planning", "savings", "kitchen"]),
        ),
        KnowledgeArticle(
            id="kb-004",
            title="Active Commuting: Cycling and Walking",
            category="travel-transport",
            summary="Health, financial, and environmental benefits of replacing short car journeys with cycling or walking, including practical transition guidance.",
            content="For journeys under 5-8 km, cycling is often faster than driving when accounting for parking time and traffic in urban areas. The direct running cost of a car averages €0.30-0.45 per kilometre (fuel, insurance, depreciation, maintenance), while cycling costs approximately €0.05-0.10 per kilometre (maintenance, equipment amortisation).\n\nEnvironmental impact: a typical car emits approximately 189g CO₂ per kilometre (European Environment Agency fleet average), while cycling emits approximately 8g CO₂/km (lifecycle manufacturing and food energy).",
            audience=json.dumps(["individual"]),
            implementation_steps=json.dumps([
                "Map your regular short journeys (under 8 km) on a route planner",
                "Test the route at a quiet time to assess safety and duration",
                "Ensure your bicycle is roadworthy (brakes, lights, tyres, bell)",
                "Start with one or two cycling days per week",
                "Plan for weather: invest in waterproof panniers and a rain jacket",
                "Arrange secure parking at your destination",
            ]),
            limitations=json.dumps([
                "Safety depends on local cycling infrastructure",
                "Weather, terrain, and physical fitness affect feasibility",
                "Not suitable for journeys requiring cargo transport",
                "Emission factors are approximate population averages",
            ]),
            source_title="European Cycling Federation — Benefits of Cycling",
            source_publisher="European Cycling Federation",
            source_url="https://ecf.com/what-we-do/cycling-economy",
            publication_date="2024-05-01",
            last_verified_date="2024-09-15",
            verification_status="verified",
            tags=json.dumps(["cycling", "walking", "commute", "transport", "emissions", "health"]),
        ),
        KnowledgeArticle(
            id="kb-006",
            title="Water Conservation at Home",
            category="water-nature",
            summary="Practical water-saving measures including aerated fixtures, dual-flush toilets, and leak detection that reduce both water and water-heating energy bills.",
            content="Domestic water consumption in Europe averages 120-150 litres per person per day. Showers and baths account for approximately 30%, toilets 25%, and laundry 15%.\n\nAerated showerheads reduce flow from a typical 12 L/min to 7-8 L/min without noticeably reducing water pressure. For a household taking combined 20 minutes of daily showers, this saves approximately 100 litres per day, plus the energy needed to heat that water.\n\nDual-flush toilets use 3-4 litres for a short flush versus 9-13 litres for older single-flush models.",
            audience=json.dumps(["individual", "household", "business"]),
            implementation_steps=json.dumps([
                "Test current showerhead flow rate by timing how long to fill a 1-litre container",
                "Install aerator attachments on taps and replace shower heads with low-flow models",
                "Check toilets for running leaks using the food colouring test",
                "Run washing machines and dishwashers only with full loads",
                "Report dripping taps and running toilets promptly for repair",
            ]),
            limitations=json.dumps([
                "Water pricing structures vary significantly by region",
                "Savings depend on current fixture efficiency and household size",
                "Old plumbing may require professional assessment for fixture changes",
            ]),
            source_title="Waterwise — Water Saving Tips",
            source_publisher="Waterwise",
            source_url="https://www.waterwise.org.uk/save-water/",
            publication_date="2024-02-10",
            last_verified_date="2024-08-20",
            verification_status="verified",
            tags=json.dumps(["water", "conservation", "fixtures", "energy", "savings"]),
        ),
    ]
    for a in articles:
        existing = db.query(KnowledgeArticle).filter(KnowledgeArticle.id == a.id).first()
        if not existing:
            db.add(a)
    db.commit()
    print(f"  ✓ {len(articles)} knowledge articles seeded")


def seed_actions(db):
    """Create sample action plan entries."""
    actions = [
        Action(
            id="act-demo-001",
            workspace_id="ws-personal-001",
            recommendation_id="rec-001",
            title="Replace kitchen and living room lights with LED",
            category="home-energy",
            status="completed",
            planned_date="2024-09-15",
            completed_date="2024-09-20",
            initial_estimate_amount=36.00,
            initial_estimate_currency="EUR",
            actual_expenditure_amount=31.50,
            actual_savings_amount=4.80,
            notes="Replaced 8 bulbs. Used E27 warm white 9W LEDs from local hardware store.",
        ),
        Action(
            id="act-demo-002",
            workspace_id="ws-personal-001",
            recommendation_id="rec-002",
            title="Install switched power strips in home office",
            category="home-energy",
            status="in-progress",
            planned_date="2024-10-01",
            initial_estimate_amount=25.00,
            initial_estimate_currency="EUR",
            notes="Purchased 2 surge-protected strips. Setting up this week.",
        ),
        Action(
            id="act-demo-003",
            workspace_id="ws-personal-001",
            recommendation_id="rec-003",
            title="Start weekly meal planning",
            category="food-kitchen",
            status="planned",
            planned_date="2024-11-01",
            initial_estimate_amount=0,
            initial_estimate_currency="EUR",
            notes="Planning to start in November. Need to set up a meal planning template.",
        ),
    ]
    for a in actions:
        existing = db.query(Action).filter(Action.id == a.id).first()
        if not existing:
            db.add(a)
    db.commit()
    print(f"  ✓ {len(actions)} actions seeded")


def main():
    if os.getenv("ECOTWIN_ALLOW_DEMO_SEED") != "1":
        raise SystemExit(
            "Demo seeding is disabled by default. Set ECOTWIN_ALLOW_DEMO_SEED=1 only "
            "when using a disposable presentation database."
        )
    print("Seeding EcoTwin AI demo data...")
    print("(All data is sample/demonstration data)\n")

    # Ensure tables exist
    init_db()

    db = SessionLocal()
    try:
        seed_workspaces(db)
        seed_resource_records(db)
        seed_knowledge_articles(db)
        seed_actions(db)
        print("\n✓ Demo data seeded successfully.")
        print("  Note: This is sample data for demonstration purposes only.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
