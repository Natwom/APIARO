import os
os.environ["DATABASE_URL"] = "postgresql://postgres:Apiaro%402026@db.zanbrmuqrlsydgvmzzgj.supabase.co:5432/postgres"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import User, Category, Product, Order, OrderItem, PasswordResetToken, SearchHistory

# SQLite source
sqlite_engine = create_engine("sqlite:///./kenya_ecommerce.db")
SQLiteSession = sessionmaker(bind=sqlite_engine)
sqlite_db = SQLiteSession()

# Supabase target
from app.database import engine as pg_engine, SessionLocal as PGSession
pg_db = PGSession()

# Migrate in order (respect foreign keys)
tables = [
    ("users", User),
    ("categories", Category),
    ("products", Product),
    ("orders", Order),
    ("order_items", OrderItem),
    ("password_reset_tokens", PasswordResetToken),
    ("search_history", SearchHistory),
]

for name, model in tables:
    print(f"Migrating {name}...")
    rows = sqlite_db.query(model).all()
    for row in rows:
        pg_db.merge(row)
    pg_db.commit()
    print(f"  ✅ {len(rows)} rows migrated")

print("🎉 All data migrated!")

sqlite_db.close()
pg_db.close()