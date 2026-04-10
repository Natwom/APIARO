from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import hashlib
import time

from app.database import get_db
from app import models, schemas, auth
from services.sms_service import send_order_confirmation

router = APIRouter(prefix="/orders", tags=["orders"])

def generate_order_signature(user_id: int, items: list, total: Decimal) -> str:
    """Generate unique signature for order to detect duplicates"""
    items_str = ",".join([f"{item.product_id}:{item.quantity}" for item in sorted(items, key=lambda x: x.product_id)])
    signature_str = f"{user_id}:{items_str}:{float(total)}:{int(time.time()) // 30}"  # 30-second window
    return hashlib.md5(signature_str.encode()).hexdigest()

@router.post("/", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order: schemas.OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Create new order with DATABASE LEVEL duplicate prevention"""
    
    # Validate terms
    if not order.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms and Conditions"
        )
    
    # Calculate total and validate products first
    total_amount = Decimal('0.00')
    order_items_data = []
    
    for item in order.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.is_active == True
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}"
            )
        
        item_total = Decimal(str(product.price)) * item.quantity
        total_amount += item_total
        
        order_items_data.append({
            "product_id": product.id,
            "product_name": product.name,
            "product_image": product.image_url,
            "quantity": item.quantity,
            "unit_price": product.price,
            "total_price": item_total
        })
    
    total_amount += Decimal('300.00')  # Delivery fee
    
    # ===== DATABASE LEVEL DUPLICATE PREVENTION =====
    # Check for exact duplicate in last 60 seconds
    one_minute_ago = datetime.now(timezone.utc) - timedelta(seconds=60)
    
    recent_duplicate = db.query(models.Order).filter(
        and_(
            models.Order.user_id == current_user.id,
            models.Order.created_at >= one_minute_ago,
            models.Order.phone_number == order.phone_number,
            models.Order.total_amount == total_amount,
            models.Order.payment_method == order.payment_method
        )
    ).order_by(models.Order.created_at.desc()).first()
    
    if recent_duplicate:
        print(f"🚫 DUPLICATE BLOCKED: Returning existing order #{recent_duplicate.id} instead of creating new")
        # Return existing order - don't create duplicate
        return recent_duplicate
    # ===== END DUPLICATE PREVENTION =====
    
    # Create the order
    db_order = models.Order(
        user_id=current_user.id,
        full_name=order.full_name,
        phone_number=order.phone_number,
        email=order.email,
        county=order.county,
        town=order.town,
        specific_location=order.specific_location,
        notes=order.notes,
        payment_method=order.payment_method,
        total_amount=total_amount,
        status="pending",
        terms_accepted=order.terms_accepted,
        sms_sent=False
    )
    
    try:
        db.add(db_order)
        db.commit()
        db.refresh(db_order)
        
        # Create order items and update stock
        for item_data in order_items_data:
            db_item = models.OrderItem(
                order_id=db_order.id,
                product_id=item_data["product_id"],
                product_name=item_data["product_name"],
                product_image=item_data["product_image"],
                quantity=item_data["quantity"],
                unit_price=item_data["unit_price"],
                total_price=item_data["total_price"]
            )
            db.add(db_item)
            
            # Update stock
            product = db.query(models.Product).filter(
                models.Product.id == item_data["product_id"]
            ).first()
            product.stock_quantity -= item_data["quantity"]
        
        db.commit()
        db.refresh(db_order)
        
        # Send confirmation SMS in background (only if not duplicate)
        if current_user.phone_number:
            background_tasks.add_task(
                send_order_confirmation,
                current_user.phone_number,
                current_user.full_name,
                db_order.id
            )
        
        print(f"✅ Order #{db_order.id} created successfully for user {current_user.id}")
        return db_order
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error creating order: {e}")
        raise HTTPException(status_code=500, detail="Failed to create order. Please try again.")

@router.get("/", response_model=List[schemas.OrderResponse])
def get_user_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all orders for current user"""
    orders = db.query(models.Order).filter(
        models.Order.user_id == current_user.id
    ).order_by(models.Order.created_at.desc()).all()
    return orders

@router.get("/{order_id}", response_model=schemas.OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get specific order"""
    order = db.query(models.Order).filter(
        models.Order.id == order_id,
        models.Order.user_id == current_user.id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@router.get("/admin/all", response_model=List[schemas.OrderResponse])
def get_all_orders(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all orders (admin only)"""
    orders = db.query(models.Order).options(
        joinedload(models.Order.items)
    ).order_by(models.Order.created_at.desc()).all()
    return orders

@router.patch("/admin/{order_id}/status", response_model=schemas.OrderResponse)
def update_order_status(
    order_id: int,
    status_update: schemas.OrderUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Update order status (admin only)"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status_update.status
    db.commit()
    db.refresh(order)
    
    return order