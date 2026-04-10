import os
import sys

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Category

# Get database URL from environment
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./kenya_ecommerce.db")

# Fix postgres:// to postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def seed_categories():
    db = SessionLocal()
    
    try:
        # Check if categories exist
        if db.query(Category).first():
            print("Categories already exist!")
            return
        
        categories = [
            Category(name="Electronics", slug="electronics", description="Phones, laptops, and gadgets"),
            Category(name="Fashion", slug="fashion", description="Clothing, shoes, and accessories"),
            Category(name="Home & Living", slug="home-living", description="Furniture and home appliances"),
            Category(name="Agriculture", slug="agriculture", description="Farming tools and supplies"),
        ]
        
        db.add_all(categories)
        db.commit()
        print(f"✅ Created {len(categories)} categories")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_categories()