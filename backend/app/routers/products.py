from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import io
from datetime import datetime, timezone
import traceback

import cloudinary
import cloudinary.uploader

from app.database import get_db
import app.models as models
import app.schemas as schemas
from app import auth

router = APIRouter(prefix="/products", tags=["products"])


def optimize_cloudinary_url(url: Optional[str], width: int = 400, height: int = 300) -> str:
    """Serve optimized Cloudinary images. Converts full-res to resized/compressed."""
    if not url:
        return "https://via.placeholder.com/400"
    
    if 'cloudinary.com' not in url:
        return url
    
    # Skip if already transformed
    if any(x in url for x in ['w_', 'h_', 'c_fill', 'c_fit']):
        return url
    
    parts = url.split('/upload/')
    if len(parts) == 2:
        return f"{parts[0]}/upload/c_fill,w_{width},h_{height},q_auto,f_auto/{parts[1]}"
    
    return url


# ============== ADMIN ENDPOINTS ==============

@router.post("/admin/upload-image")
async def upload_product_image(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Upload a product image to Cloudinary and return the URL"""
    print(f"Upload attempt by user: {current_user.email}")
    
    try:
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type: {file.content_type}. Allowed: JPEG, PNG, GIF, WEBP"
            )
        
        file_content = await file.read()
        max_size = 5 * 1024 * 1024
        
        if len(file_content) > max_size:
            raise HTTPException(status_code=400, detail="File too large. Max size is 5MB.")
        
        result = cloudinary.uploader.upload(
            io.BytesIO(file_content),
            folder="ecommerce_products",
            resource_type="image"
        )
        
        image_url = result["secure_url"]
        
        print(f"Image uploaded to Cloudinary: {image_url}")
        
        return {
            "success": True,
            "image_url": image_url,
            "full_url": image_url,
            "filename": result.get("public_id", "unknown")
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
            gallery_images=product.gallery_images,
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
    skip: int = 0,
    limit: int = Query(100, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all products for admin (paginated)"""
    return db.query(models.Product).order_by(models.Product.created_at.desc()).offset(skip).limit(limit).all()


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

@router.get("/")
def get_products(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    db: Session = Depends(get_db)
):
    """
    Get active products with pagination, filtering, and sorting.
    Returns 12 products per page with optimized Cloudinary thumbnails.
    """
    try:
        # Manual validation (avoids Pydantic regex issues)
        allowed_sort = {"created_at", "price", "name"}
        allowed_order = {"asc", "desc"}
        
        if sort_by not in allowed_sort:
            sort_by = "created_at"
        if sort_order not in allowed_order:
            sort_order = "desc"
        
        query = db.query(models.Product).filter(models.Product.is_active == True)
        
        if category_id:
            query = query.filter(models.Product.category_id == category_id)
        
        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (models.Product.name.ilike(search_term)) | 
                (models.Product.description.ilike(search_term))
            )
        
        if min_price is not None:
            query = query.filter(models.Product.price >= min_price)
        if max_price is not None:
            query = query.filter(models.Product.price <= max_price)
        
        # Sorting
        sort_column = getattr(models.Product, sort_by)
        if sort_order == "desc":
            sort_column = sort_column.desc()
        query = query.order_by(sort_column)
        
        # Get total count
        total = query.count()
        
        # Pagination
        offset = (page - 1) * per_page
        products = query.offset(offset).limit(per_page).all()
        
        total_pages = (total + per_page - 1) // per_page if total > 0 else 1
        
        # Serialize safely
        items = []
        for p in products:
            try:
                # Handle both 'stock' and 'stock_quantity' column names
                stock_val = getattr(p, "stock_quantity", None)
                if stock_val is None:
                    stock_val = getattr(p, "stock", 0)
                
                # Handle created_at safely
                created_val = None
                if hasattr(p, "created_at") and p.created_at is not None:
                    if isinstance(p.created_at, datetime):
                        created_val = p.created_at.isoformat()
                    else:
                        created_val = str(p.created_at)
                
                item = {
                    "id": p.id,
                    "name": p.name,
                    "description": p.description,
                    "price": float(p.price) if p.price is not None else 0.0,
                    "stock_quantity": stock_val,
                    "image_url": optimize_cloudinary_url(getattr(p, "image_url", None), 400, 300),
                    "gallery_images": [],
                    "category_id": getattr(p, "category_id", None),
                    "is_active": getattr(p, "is_active", True),
                    "created_at": created_val,
                }
                
                # Handle gallery images safely
                gallery = getattr(p, "gallery_images", None)
                if gallery:
                    if isinstance(gallery, list):
                        item["gallery_images"] = [optimize_cloudinary_url(g, 400, 300) for g in gallery if g]
                    elif isinstance(gallery, str):
                        item["gallery_images"] = [optimize_cloudinary_url(gallery, 400, 300)]
                
                items.append(item)
                
            except Exception as item_err:
                print(f"Error serializing product {getattr(p, 'id', 'unknown')}: {item_err}")
                continue
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "per_page": per_page,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"FATAL ERROR in get_products: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")


@router.get("/{product_id}", response_model=schemas.ProductResponse)
def get_product(product_id: int, db: Session = Depends(get_db)):
    """Get a specific product with optimized detail-view image"""
    try:
        product = db.query(models.Product).filter(
            models.Product.id == product_id,
            models.Product.is_active == True
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Optimize to larger size for detail view but still compressed
        if product.image_url and 'cloudinary.com' in product.image_url:
            product.image_url = optimize_cloudinary_url(product.image_url, 800, 600)
        
        if product.gallery_images:
            if isinstance(product.gallery_images, list):
                product.gallery_images = [
                    optimize_cloudinary_url(g, 800, 600) if g and 'cloudinary.com' in g else g
                    for g in product.gallery_images
                ]
            elif isinstance(product.gallery_images, str):
                product.gallery_images = [optimize_cloudinary_url(product.gallery_images, 800, 600)]
        
        return product
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_product: {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")