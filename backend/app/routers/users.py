from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
import random
import sys
import os
from datetime import datetime, timedelta, timezone
from app.database import get_db
from app import models, schemas, auth

# Fix import path for services
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from services.sms_service import SMSServiceFactory

router = APIRouter(prefix="/users", tags=["users"])


def create_admin_user_if_not_exists(db: Session):
    """Auto-create admin user if it doesn't exist"""
    admin_email = "admin@kenyashop.co.ke"
    admin_user = db.query(models.User).filter(models.User.email == admin_email).first()
    
    if not admin_user:
        print(f"Creating admin user: {admin_email}")
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
        print(f"Admin user created with ID: {admin_user.id}")
    return admin_user


@router.post("/register", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Normalize email
    email = user.email.lower().strip()
    
    # Check if email exists
    db_user = db.query(models.User).filter(models.User.email == email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if phone exists
    db_phone = db.query(models.User).filter(models.User.phone_number == user.phone_number).first()
    if db_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    
    # Create new user
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
    # Auto-create admin if logging in as admin and doesn't exist
    if user_credentials.email == "admin@kenyashop.co.ke":
        create_admin_user_if_not_exists(db)
    
    user = db.query(models.User).filter(
        models.User.email == user_credentials.email.lower().strip()
    ).first()
    
    # CASE 1: Email not registered
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Account not found. Please register first."
        )
    
    # CASE 2: Wrong password
    password_valid = auth.verify_password(user_credentials.password, user.password_hash)
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password. Please check your credentials and try again."
        )
    
    # CASE 3: Success
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone_number": user.phone_number
        }
    }


# ========== FORGOT PASSWORD WITH SMS ==========

def mask_phone_number(phone: str) -> str:
    """Mask phone number for privacy: +2547XX XXX XXX"""
    if len(phone) >= 12:
        return f"{phone[:5]}X XX XXX XXX"
    return phone[:5] + "XXXXXXX"


def generate_reset_code() -> str:
    """Generate 6-digit random code"""
    return str(random.randint(100000, 999999))


@router.post("/forgot-password", response_model=schemas.ForgotPasswordResponse)
async def forgot_password(
    request: schemas.ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Request password reset - sends 6-digit code via SMS
    """
    email = request.email.lower().strip()
    
    # Find user
    user = db.query(models.User).filter(models.User.email == email).first()
    
    # Generate code regardless of user existence (security: don't reveal if email exists)
    reset_code = generate_reset_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)  # 15 min expiry
    
    # Invalidate any existing unused tokens for this email
    existing_tokens = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.email == email,
        models.PasswordResetToken.used == False
    ).all()
    for token in existing_tokens:
        token.used = True  # Mark as used to invalidate
    
    # Save new token
    db_token = models.PasswordResetToken(
        email=email,
        phone_number=user.phone_number if user else "",
        reset_code=reset_code,
        expires_at=expires_at,
        used=False
    )
    db.add(db_token)
    db.commit()
    
    # Only send SMS if user exists
    if user:
        # Initialize SMS service
        sms_service = SMSServiceFactory.get_service()
        
        message = (
            f"Your APIARO password reset code is: {reset_code}. "
            f"Valid for 15 minutes. Do not share this code with anyone."
        )
        
        # Send SMS in background
        background_tasks.add_task(
            sms_service.send_sms,
            user.phone_number,
            message
        )
        
        # Also log for development
        print(f"\n{'='*60}")
        print(f"PASSWORD RESET SMS")
        print(f"To: {user.phone_number}")
        print(f"Code: {reset_code}")
        print(f"Expires: {expires_at}")
        print(f"{'='*60}\n")
        
        return {
            "message": "If an account exists with this email, you will receive a reset code via SMS.",
            "phone_masked": mask_phone_number(user.phone_number)
        }
    
    # Return same message even if user doesn't exist (security)
    return {
        "message": "If an account exists with this email, you will receive a reset code via SMS.",
        "phone_masked": None
    }


@router.post("/verify-reset-code")
async def verify_reset_code(
    request: schemas.VerifyResetCodeRequest,
    db: Session = Depends(get_db)
):
    """
    Verify if reset code is valid (optional step for UX)
    """
    email = request.email.lower().strip()
    
    reset_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.email == email,
        models.PasswordResetToken.reset_code == request.reset_code,
        models.PasswordResetToken.used == False,
        models.PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset code"
        )
    
    return {
        "valid": True,
        "message": "Code verified successfully"
    }


@router.post("/reset-password")
async def reset_password(
    request: schemas.ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    """
    Reset password using SMS code
    """
    email = request.email.lower().strip()
    
    # Find valid token
    reset_token = db.query(models.PasswordResetToken).filter(
        models.PasswordResetToken.email == email,
        models.PasswordResetToken.reset_code == request.reset_code,
        models.PasswordResetToken.used == False,
        models.PasswordResetToken.expires_at > datetime.now(timezone.utc)
    ).first()
    
    if not reset_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset code. Please request a new one."
        )
    
    # Find user
    user = db.query(models.User).filter(models.User.email == email).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update password
    user.password_hash = auth.get_password_hash(request.new_password)
    reset_token.used = True
    
    db.commit()
    
    # Send confirmation SMS
    sms_service = SMSServiceFactory.get_service()
    confirm_message = (
        f"Your APIARO password has been reset successfully. "
        f"If you did not do this, please contact support immediately."
    )
    
    try:
        sms_service.send_sms(user.phone_number, confirm_message)
    except Exception as e:
        print(f"Failed to send confirmation SMS: {e}")
    
    return {
        "message": "Password reset successful. You can now login with your new password."
    }


@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user


@router.get("/admin/all", response_model=List[schemas.UserResponse])
def get_all_users_admin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all users for admin panel"""
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return users