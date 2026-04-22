from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from enum import Enum

class PaymentMethod(str, Enum):
    cod = "cod"
    mpesa = "mpesa"
    card = "card"

class OrderStatus(str, Enum):
    pending = "pending"
    paid = "paid"
    processing = "processing"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"

# ========== ADDED: Password Reset Schemas ==========
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ForgotPasswordResponse(BaseModel):
    message: str
    phone_masked: Optional[str] = None

class VerifyResetCodeRequest(BaseModel):
    email: EmailStr
    reset_code: str = Field(..., min_length=6, max_length=6)

class ResetPasswordRequest(BaseModel):
    email: EmailStr
    reset_code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6)

# ========== ADDED: Search History Schemas ==========
class SearchHistoryBase(BaseModel):
    search_query: str

class SearchHistoryCreate(SearchHistoryBase):
    pass

class SearchHistoryResponse(SearchHistoryBase):
    id: int
    user_id: Optional[int] = None
    search_count: int
    last_searched: datetime
    
    class Config:
        from_attributes = True

class SearchHistoryList(BaseModel):
    searches: List[SearchHistoryResponse]

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    phone_number: str = Field(..., pattern=r'^\+254\d{9}$')

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Product Schemas
class ProductBase(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    stock_quantity: int = 0
    image_url: Optional[str] = None

class ProductResponse(ProductBase):
    id: int
    category_id: Optional[int] = None
    is_active: bool
    
    class Config:
        from_attributes = True

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    stock_quantity: int = 0
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    
    class Config:
        from_attributes = True

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    stock_quantity: Optional[int] = None
    image_url: Optional[str] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    
    class Config:
        from_attributes = True

# Order Item Schemas
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)

class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_image: Optional[str] = None
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    
    class Config:
        from_attributes = True

# Order Schemas
class OrderCreate(BaseModel):
    full_name: str
    phone_number: str = Field(..., pattern=r'^\+254\d{9}$')
    email: EmailStr
    county: str
    town: str
    specific_location: str
    notes: Optional[str] = None
    payment_method: PaymentMethod
    terms_accepted: bool = False
    items: List[OrderItemCreate]

class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None

class OrderResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    phone_number: str
    email: str
    county: str
    town: str
    specific_location: str
    notes: Optional[str]
    payment_method: PaymentMethod
    total_amount: Decimal
    status: OrderStatus
    terms_accepted: bool
    sms_sent: bool
    created_at: datetime
    items: List[OrderItemResponse]
    
    class Config:
        from_attributes = True

# Cart Item (for frontend)
class CartItem(BaseModel):
    product_id: int
    name: str
    price: Decimal
    quantity: int
    image_url: Optional[str] = None