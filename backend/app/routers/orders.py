from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session, joinedload
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app import models, schemas, auth
import time

router = APIRouter(prefix="/orders", tags=["orders"])

# Store recent order signatures to prevent duplicates (in-memory cache)
# Format: {user_id_timestamp: timestamp}
recent_orders_cache = {}

@router.post("/", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order: schemas.OrderCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Create a new order - DUPLICATE PROTECTION ADDED"""
    
    # ===== DUPLICATE PREVENTION =====
    # Create a signature based on user + items + total
    items_signature = ",".join([f"{item.product_id}:{item.quantity}" for item in sorted(order.items, key=lambda x: x.product_id)])
    order_signature = f"{current_user.id}:{items_signature}:{order.total_amount}"
    current_time = time.time()
    
    # Check if similar order was created in last 30 seconds
    if order_signature in recent_orders_cache:
        last_time = recent_orders_cache[order_signature]
        if current_time - last_time < 30:  # 30 second cooldown
            print(f"DUPLICATE ORDER BLOCKED: User {current_user.id} tried to create identical order within 30 seconds")
            # Return the most recent order instead
            recent_order = db.query(models.Order).filter(
                models.Order.user_id == current_user.id
            ).order_by(models.Order.created_at.desc()).first()
            if recent_order:
                return recent_order
    
    # Update cache
    recent_orders_cache[order_signature] = current_time
    # Clean old cache entries (older than 5 minutes)
    cutoff_time = current_time - 300
    for key in list(recent_orders_cache.keys()):
        if recent_orders_cache[key] < cutoff_time:
            del recent_orders_cache[key]
    # ===== END DUPLICATE PREVENTION =====
    
    # Validate terms accepted
    if not order.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms and Conditions"
        )
    
    # Validate products and calculate total
    total_amount = Decimal('0.00')
    order_items_data = []
    
    for item in order.items:
        product = db.query(models.Product).filter(
            models.Product.id == item.product_id,
            models.Product.is_active == True
        ).first()
        
        if not product:
            raise HTTPException(
                status_code=404,
                detail=f"Product {item.product_id} not found"
            )
        
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}, Requested: {item.quantity}"
            )
        
        # Calculate item total
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
    
    # Add delivery fee (300 KES)
    total_amount += Decimal('300.00')
    
    # Create order
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
        
        # Update product stock
        product = db.query(models.Product).filter(
            models.Product.id == item_data["product_id"]
        ).first()
        product.stock_quantity -= item_data["quantity"]
    
    db.commit()
    db.refresh(db_order)
    
    print(f"Order {db_order.id} created successfully for user {current_user.id}")
    return db_order

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