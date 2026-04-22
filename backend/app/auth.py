from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
import hashlib

SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 43200

security = HTTPBearer()

def verify_password(plain_password, hashed_password):
    """Verify password using SHA256 hash"""
    return hashlib.sha256(plain_password.encode()).hexdigest() == hashed_password

def get_password_hash(password):
    """Hash password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token with timezone-aware expiration"""
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access"
    })
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security), 
    db: Session = Depends(get_db)
):
    """Get current authenticated user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token_preview = credentials.credentials[:20] + "..." if len(credentials.credentials) > 20 else credentials.credentials
    print(f"Received credentials: {token_preview}")
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        exp = payload.get("exp")
        token_type = payload.get("type")
        
        print(f"Decoded user_id: {user_id}, exp: {exp}, type: {token_type}")
        
        if user_id is None:
            print("No user_id in token")
            raise credentials_exception
            
        current_timestamp = datetime.now(timezone.utc).timestamp()
        
        if exp and current_timestamp > exp:
            print(f"Token expired! Current: {current_timestamp}, Exp: {exp}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired. Please login again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
    except JWTError as e:
        print(f"JWT Error: {e}")
        raise credentials_exception
    
    try:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    except (ValueError, TypeError):
        print(f"Invalid user_id format: {user_id}")
        raise credentials_exception
        
    if user is None:
        print(f"User {user_id} not found in database")
        raise credentials_exception
    
    if hasattr(user, 'is_active') and not user.is_active:
        print(f"User {user.email} is inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
        
    print(f"Authenticated user: {user.email}")
    return user

# ========== ADDED: Optional current user (for guest search history) ==========
async def get_current_user_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[models.User]:
    """Get current user if logged in, else None (for guest users)."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
            
        current_timestamp = datetime.now(timezone.utc).timestamp()
        exp = payload.get("exp")
        if exp and current_timestamp > exp:
            return None
            
    except JWTError:
        return None
    
    try:
        user = db.query(models.User).filter(models.User.id == int(user_id)).first()
        return user
    except (ValueError, TypeError):
        return None

def get_current_active_user(current_user: models.User = Depends(get_current_user)):
    """Dependency to get current active user"""
    return current_user

def get_current_admin_user(current_user: models.User = Depends(get_current_active_user)):
    """Dependency to ensure user is admin"""
    if not getattr(current_user, 'is_admin', False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    return current_user