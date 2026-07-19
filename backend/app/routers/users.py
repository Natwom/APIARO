from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import random
import sys
import os
import time
import shutil
from datetime import datetime, timedelta, timezone

backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.database import get_db
from app import models, schemas, auth
from services.sms_service import SMSServiceFactory

router = APIRouter(prefix="/users", tags=["users"])

_login_cache = {}

# Ensure avatars directory exists
AVATARS_DIR = os.path.join(backend_dir, "uploads", "avatars")
os.makedirs(AVATARS_DIR, exist_ok=True)

def create_admin_user_if_not_exists(db: Session):
    admin_email = "admin@kenyashop.co.ke"
    admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
    
    if not admin_user:
        print(f"Creating admin: {admin_email}")
        hashed_password = auth.get_password_hash("admin123")
        admin_user = models.User(
            email=admin_email,
            password_hash=hashed_password,
            full_name="System Administrator",
            phone_number="+254700000000"
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
    return admin_user

@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    email = user.email.lower().strip()
    
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    if db.query(models.User).filter(models.User.phone_number == user.phone_number).first():
        raise HTTPException(status_code=400, detail="Phone already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=email,
        password_hash=hashed_password,
        full_name=user.full_name,
        phone_number=user.phone_number
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.post("/login")
def login(user_credentials: schemas.UserLogin, db: Session = Depends(get_db)):
    if user_credentials.email.lower().strip() == "admin@kenyashop.co.ke":
        create_admin_user_if_not_exists(db)
    
    email = user_credentials.email.lower().strip()
    
    # Cache check
    cached = _login_cache.get(email)
    if cached and (time.time() - cached["timestamp"]) < 300:
        print(f"📦 CACHE HIT: login {email}")
        user = db.query(models.User).filter(models.User.email == email).first()
        if user and auth.verify_password(user_credentials.password, user.password_hash):
            return cached["response"]
    
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please register first.")
    
    if not auth.verify_password(user_credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password.")
    
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    
    response = {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone_number": user.phone_number,
            "profile_picture": user.profile_picture,
            "is_admin": getattr(user, 'is_admin', user.email == "admin@kenyashop.co.ke")
        }
    }
    
    _login_cache[email] = {"response": response, "timestamp": time.time()}
    return response

@router.post("/forgot-password")
async def forgot_password(request: schemas.ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    email = request.email.lower().strip()
    user = db.query(models.User).filter(models.User.email == email).first()
    
    reset_code = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
    
    for token in db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.email == email,
        models.PasswordResetToken.used == False
    ).all():
        token.used = True
    
    db_token = models.PasswordResetToken(
        email=email,
        phone_number=user.phone_number if user else "",
        reset_code=reset_code,
        expires_at=expires_at,
        used=False
    )
    db.add(db_token)
    db.commit()
    
    if user:
        sms_service = SMSServiceFactory.get_service()
        message = f"Your APIARO password reset code is: {reset_code}. Valid for 15 minutes."
        background_tasks.add_task(sms_service.send_sms, user.phone_number, message)
        
        return {
            "message": "Reset code sent via SMS.",
            "phone_masked": f"{user.phone_number[:5]}X XX XXX XXX"
        }
    
    return {"message": "If account exists, reset code sent.", "phone_masked": None}

@router.post("/verify-reset-code")
async def verify_reset_code(request: schemas.VerifyResetCodeRequest, db: Session = Depends(get_db)):
    email = request.email.lower().strip()
    
    token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.email == email,
        models.PasswordResetToken.reset_code == request.reset_code,
        models.PasswordResetToken.used == False,
        models.PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    return {"valid": True, "message": "Code verified"}

@router.post("/reset-password")
async def reset_password(request: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    email = request.email.lower().strip()
    
    token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.email == email,
        models.PasswordResetToken.reset_code == request.reset_code,
        models.PasswordResetToken.used == False,
        models.PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.password_hash = auth.get_password_hash(request.new_password)
    token.used = True
    db.commit()
    
    return {"message": "Password reset successful. Login with new password."}

# ========== NEW: Profile Endpoints ==========

@router.get("/me/profile", response_model=schemas.UserProfileResponse)
def get_user_profile(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get full user profile including order count"""
    total_orders = db.query(models.Order).filter(
        models.Order.user_id == current_user.id
    ).count()
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone_number": current_user.phone_number,
        "profile_picture": current_user.profile_picture,
        "bio": current_user.bio,
        "address": current_user.address,
        "county": current_user.county,
        "town": current_user.town,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "total_orders": total_orders
    }

@router.put("/me/profile", response_model=schemas.UserProfileResponse)
def update_user_profile(
    profile_data: schemas.UserProfileUpdate,
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update user profile information"""
    # Check if phone number is already used by another user
    if profile_data.phone_number:
        existing = db.query(models.User).filter(
            models.User.phone_number == profile_data.phone_number,
            models.User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Update fields
    update_data = profile_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(current_user, field, value)
    
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)
    
    total_orders = db.query(models.Order).filter(
        models.Order.user_id == current_user.id
    ).count()
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "phone_number": current_user.phone_number,
        "profile_picture": current_user.profile_picture,
        "bio": current_user.bio,
        "address": current_user.address,
        "county": current_user.county,
        "town": current_user.town,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at,
        "total_orders": total_orders
    }

@router.post("/me/avatar", response_model=schemas.AvatarUploadResponse)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Upload profile picture/avatar"""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Validate file size (max 5MB)
    max_size = 5 * 1024 * 1024  # 5MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large. Max size: 5MB")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1].lower()
    if file_ext not in ['jpg', 'jpeg', 'png', 'webp']:
        file_ext = 'jpg'
    
    timestamp = int(time.time())
    filename = f"avatar_{current_user.id}_{timestamp}.{file_ext}"
    file_path = os.path.join(AVATARS_DIR, filename)
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Delete old avatar if exists
    if current_user.profile_picture:
        old_filename = current_user.profile_picture.split('/')[-1]
        old_path = os.path.join(AVATARS_DIR, old_filename)
        if os.path.exists(old_path) and old_filename.startswith(f"avatar_{current_user.id}_"):
            os.remove(old_path)
    
    # Update user profile_picture
    avatar_url = f"/uploads/avatars/{filename}"
    current_user.profile_picture = avatar_url
    current_user.updated_at = datetime.utcnow()
    db.commit()
    
    return {"profile_picture": avatar_url, "message": "Avatar updated successfully"}

@router.delete("/me/avatar")
def delete_avatar(
    current_user: models.User = Depends(auth.get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete profile picture"""
    if current_user.profile_picture:
        old_filename = current_user.profile_picture.split('/')[-1]
        old_path = os.path.join(AVATARS_DIR, old_filename)
        if os.path.exists(old_path):
            os.remove(old_path)
        
        current_user.profile_picture = None
        current_user.updated_at = datetime.utcnow()
        db.commit()
    
    return {"message": "Avatar removed successfully"}

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

@router.get("/admin/all", response_model=List[schemas.UserResponse])
def get_all_users_admin(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_active_user)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()