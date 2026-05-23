from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_
from typing import List
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import threading

from app.database import get_db, DATABASE_URL
from app import models, schemas, auth
from services.sms_service import send_order_confirmation

router = APIRouter(prefix="/orders", tags=["orders"])

# Lock for SQLite to prevent race conditions
db_lock = threading.Lock()

@router.post("/", response_model=schemas.OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order: schemas.OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Create new order with DUPLICATE PREVENTION"""
    
    # Validate terms
    if not order.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must accept the Terms and Conditions"
        )
    
    # Calculate totals and validate products
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
                detail=f"Insufficient stock for {product.name}"
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
    
    # ===== DUPLICATE PREVENTION (90-second window) =====
    ninety_seconds_ago = datetime.now(timezone.utc) - timedelta(seconds=90)
    
    recent_duplicate = db.query(models.Order).filter(
        and_(
            models.Order.user_id == current_user.id,
            models.Order.created_at >= ninety_seconds_ago,
            models.Order.phone_number == order.phone_number,
            models.Order.total_amount == total_amount,
            models.Order.status != "cancelled"
        )
    ).order_by(models.Order.created_at.desc()).first()
    
    if recent_duplicate:
        print(f"🚫 DUPLICATE BLOCKED: Returning existing order #{recent_duplicate.id}")
        return recent_duplicate
    # ===== END DUPLICATE PREVENTION =====
    
    # Use lock for SQLite
    is_sqlite = "sqlite" in str(DATABASE_URL)
    lock_acquired = False
    
    if is_sqlite:
        lock_acquired = db_lock.acquire(timeout=10)
        if not lock_acquired:
            raise HTTPException(status_code=503, detail="Server busy, please retry")
    
    try:
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
            sms_sent=False,
            created_at=datetime.now(timezone.utc)
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
            
            # Update stock
            product = db.query(models.Product).filter(
                models.Product.id == item_data["product_id"]
            ).first()
            if product:
                product.stock_quantity -= item_data["quantity"]
        
        db.commit()
        db.refresh(db_order)
        
        print(f"✅ Order #{db_order.id} created")
        
        # Send SMS
        try:
            background_tasks.add_task(
                send_order_confirmation,
                order.phone_number,
                order.full_name,
                db_order.id
            )
        except Exception as e:
            print(f"SMS failed: {e}")
        
        return db_order
        
    except Exception as e:
        db.rollback()
        print(f"❌ Order error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create order: {str(e)}")
    finally:
        if lock_acquired:
            db_lock.release()

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
    """Get all orders (admin)"""
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
    """Update order status"""
    order = db.query(models.Order).filter(models.Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order.status = status_update.status
    db.commit()
    db.refresh(order)
    
    return order