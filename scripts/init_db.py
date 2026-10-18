"""
EcoTwin AI — Database Initialization Script
Run: python scripts/init_db.py
"""
import sys
import os

# Add the backend directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.db.database import init_db

if __name__ == "__main__":
    print("Initializing EcoTwin AI database...")
    init_db()
    print("✓ Done. All tables created.")
