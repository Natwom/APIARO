from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import shutil
import os
from pathlib import Path
from datetime import datetime, timezone

from app.database import get_db
import app.models as models
import app.schemas as schemas
from app import auth

router = APIRouter(prefix="/products", tags=["products"])

# Create uploads directory
UPLOAD_DIR = Path("uploads/products")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# ============== ADMIN ENDPOINTS ==============

@router.post("/admin/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Upload a product image and return the URL"""
    print(f"Upload attempt by user: {current_user.email}")
    
    try:
        # Validate file type
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, GIF, WEBP"
            )
        
        # Read file content for size check
        file_content = await file.read()
        max_size = 5 * 1024 * 1024  # 5MB
        
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File too large. Max size is 5MB.")
        
        # Generate unique filename
        file_ext = file.filename.split(".")[-1].lower()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"product_{current_user.id}_{timestamp}_{os.urandom(4).hex()}.{file_ext}"
        file_path = UPLOAD_DIR / filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            buffer.write(file_content)
        
        # Return full URL
        image_url = f"/uploads/products/{filename}"
        full_url = f"https://apiaro-backend.onrender.com{image_url}"
        
        print(f"Image uploaded successfully: {filename}")
        
        return {
            "success": True,
            "image_url": image_url,
            "full_url": full_url,
            "filename": filename
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/admin", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
@router.post("/admin/", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Create a new product"""
    try:
        db_product = models.Product(
            name=product.name,
            description=product.description,
            price=product.price,
            stock_quantity=product.stock_quantity,
            image_url=product.image_url,
            category_id=product.category_id,
            is_active=True
        )
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        return db_product
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}")

@router.get("/admin/all", response_model=List[schemas.ProductResponse])
def get_all_products_admin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all products for admin"""
    return db.query(models.Product).order_by(models.Product.created_at.desc()).all()

@router.put("/admin/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Update a product"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        update_data = product_update.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_product, field, value)
        
        db.commit()
        db.refresh(db_product)
        return db_product
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update product: {str(e)}")

@router.delete("/admin/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Soft delete a product"""
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.is_active = False
    db.commit()
    return None

# ============== PUBLIC ENDPOINTS ==============

@router.get("/", response_model=List[schemas.ProductResponse])
def get_products(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all active products"""
    return db.query(models.Product).filter(
        models.Product.is_active == True
    ).order_by(models.Product.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a specific product"""
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.is_active == True
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product