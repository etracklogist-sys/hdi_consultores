"""Create resenas_capacitacion table if it doesn't exist."""
import sys, os
from dotenv import load_dotenv

# Load .env first
load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine
from app.models.domain import Base, ResenaCapacitacion

# Create only the new table
ResenaCapacitacion.__table__.create(engine, checkfirst=True)
print("OK: resenas_capacitacion table created (or already exists)")
