from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import io
import json
import time

import cloudinary
import cloudinary.uploader

from app.database import get_db
import app.models as models
import app.schemas as schemas
from app import auth

router = APIRouter(prefix="/products", tags=["products"])

_products_cache = {"data": None, "timestamp": 0, "ttl": 60}

def get_cached_products(db: Session):
    now = time.time()
    if _products_cache["data"] and (now - _products_cache["timestamp"]) < _products_cache["ttl"]:
        print("📦 CACHE HIT: products")
        return _products_cache["data"]
    
    print("🗄️ DB HIT: products")
    products = db.query(models.Product).filter(
        models.Product.is_active == True
    ).order_by(models.Product.created_at.desc()).all()
    
    for p in products:
        if p.gallery_images and isinstance(p.gallery_images, str):
            p.gallery_images = json.loads(p.gallery_images)
    
    _products_cache["data"] = products
    _products_cache["timestamp"] = now
    return products

def invalidate_products_cache():
    _products_cache["data"] = None
    _products_cache["timestamp"] = 0

@router.post("/admin/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    try:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail=f"Invalid file type")
        
        file_content = await file.read()
        if len(file_content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large")
        
        result = cloudinary.uploader.upload(
            io.BytesIO(file_content),
            folder="ecommerce_products",
            resource_type="image"
        )
        
        return {"success": True, "image_url": result["secure_url"]}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.post("/admin", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
@router.post("/admin/", response_model=schemas.ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    try:
        gallery_json = json.dumps(product.gallery_images) if product.gallery_images else None
        
        db_product = models.Product(
            name=product.name,
            description=product.description,
            price=product.price,
            original_price=product.original_price,
            stock_quantity=product.stock_quantity,
            image_url=product.image_url,
            gallery_images=gallery_json,
            category_id=product.category_id,
            rating=product.rating if product.rating is not None else 0.0,
            is_active=True
        )
        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        
        invalidate_products_cache()
        
        if db_product.gallery_images:
            db_product.gallery_images = json.loads(db_product.gallery_images)
        
        return db_product
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

@router.get("/admin/all", response_model=List[schemas.ProductResponse])
def get_all_products_admin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    products = db.query(models.Product).order_by(models.Product.created_at.desc()).all()
    for p in products:
        if p.gallery_images and isinstance(p.gallery_images, str):
            p.gallery_images = json.loads(p.gallery_images)
    return products

@router.put("/admin/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    product_update: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    try:
        update_data = product_update.dict(exclude_unset=True)
        if "gallery_images" in update_data and update_data["gallery_images"] is not None:
            update_data["gallery_images"] = json.dumps(update_data["gallery_images"])
        
        for field, value in update_data.items():
            setattr(db_product, field, value)
        
        db.commit()
        db.refresh(db_product)
        invalidate_products_cache()
        
        if db_product.gallery_images and isinstance(db_product.gallery_images, str):
            db_product.gallery_images = json.loads(db_product.gallery_images)
        
        return db_product
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed: {str(e)}")

@router.delete("/admin/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    db_product = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    db_product.is_active = False
    db.commit()
    invalidate_products_cache()
    return None

@router.get("/", response_model=List[schemas.ProductResponse])
def get_products(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    if not search and not category_id and skip == 0 and limit >= 100:
        return get_cached_products(db)
    
    query = db.query(models.Product).filter(models.Product.is_active == True)
    
    if category_id:
        query = query.filter(models.Product.category_id == category_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (models.Product.name.ilike(search_term)) | 
            (models.Product.description.ilike(search_term))
        )
    
    products = query.order_by(models.Product.created_at.desc()).offset(skip).limit(limit).all()
    
    for p in products:
        if p.gallery_images and isinstance(p.gallery_images, str):
            p.gallery_images = json.loads(p.gallery_images)
    
    return products

@router.get("/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(
        models.Product.id == product_id,
        models.Product.is_active == True
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    if product.gallery_images and isinstance(product.gallery_images, str):
        product.gallery_images = json.loads(product.gallery_images)
    
    return product