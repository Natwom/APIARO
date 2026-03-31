from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app import models, schemas, auth

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
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
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
    
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    
    print(f"Login attempt: {user_credentials.email}, User found: {user is not None}")
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    password_valid = auth.verify_password(user_credentials.password, user.password_hash)
    print(f"Password valid: {password_valid}")
    
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = auth.create_access_token(data={"sub": str(user.id)})
    print(f"Login successful for user {user.id}, token generated")
    
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

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_info(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

@router.get("/admin/all", response_model=List[schemas.UserResponse])
def get_all_users_admin(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all users for admin panel"""
    print(f"Admin endpoint accessed by: {current_user.email}")
    users = db.query(models.User).order_by(models.User.created_at.desc()).all()
    return users