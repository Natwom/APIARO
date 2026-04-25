import os
import sys

# Add backend to path (same as main.py)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import cloudinary
import cloudinary.uploader

# Use the SAME database as your app
from app.database import engine, Base
from app.config import CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
from app.models import Product
from sqlalchemy.orm import sessionmaker

# Create tables if they don't exist (same as main.py)
Base.metadata.create_all(bind=engine)

cloudinary.config(
    cloud_name=CLOUDINARY_CLOUD_NAME,
    api_key=CLOUDINARY_API_KEY,
    api_secret=CLOUDINARY_API_SECRET
)

SessionLocal = sessionmaker(bind=engine)
db = SessionLocal()

products = db.query(Product).filter(Product.image_url != None).all()

print(f"Found {len(products)} products with images")

for product in products:
    old = product.image_url or ""
    
    # Skip if already Cloudinary
    if old.startswith("https://res.cloudinary.com"):
        print(f"Already Cloudinary (skipped): {old[:60]}...")
        continue
    
    # Skip if empty
    if not old:
        continue
    
    # Extract local path from old URL format
    if old.startswith("http"):
        local_path = old.replace("https://apiaro-backend.onrender.com/", "")
    else:
        local_path = old.lstrip("/")
    
    if not os.path.exists(local_path):
        print(f"Missing file (skipped): {local_path}")
        continue
    
    try:
        result = cloudinary.uploader.upload(local_path, folder="ecommerce_products")
        product.image_url = result["secure_url"]
        print(f"Migrated: {local_path}")
    except Exception as e:
        print(f"Failed: {local_path} - {e}")

db.commit()
db.close()
print("Migration complete!")