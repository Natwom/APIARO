import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.database import engine

def migrate():
    """Add profile fields to users table if they don't exist"""
    
    columns_to_add = [
        ("profile_picture", "VARCHAR(500)"),
        ("bio", "TEXT"),
        ("address", "TEXT"),
        ("county", "VARCHAR(100)"),
        ("town", "VARCHAR(100)"),
    ]
    
    with engine.connect() as conn:
        # Check existing columns
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users'
        """))
        existing_columns = {row[0] for row in result}
        
        for col_name, col_type in columns_to_add:
            if col_name not in existing_columns:
                print(f"Adding column: {col_name} {col_type}")
                conn.execute(text(f"""
                    ALTER TABLE users 
                    ADD COLUMN {col_name} {col_type}
                """))
                conn.commit()
                print(f"✅ Added {col_name}")
            else:
                print(f"⏭️  Column {col_name} already exists, skipping")
    
    print("\n🎉 Migration complete!")

if __name__ == "__main__":
    migrate()