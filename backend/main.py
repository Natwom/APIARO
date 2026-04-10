import sys
import os
from datetime import datetime, timezone

# Fix: Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import traceback

from app.routers import users, products, orders
from app.database import engine, Base, DATABASE_URL

# Create tables
Base.metadata.create_all(bind=engine)

# Create uploads directory
if not os.path.exists("uploads"):
    os.makedirs("uploads")

app = FastAPI(
    title="Kenya E-Commerce API",
    description="Production API for Kenya E-Commerce Platform",
    version="2.0.0"
)

# CORS - Allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600,
)

# Static files
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
app.include_router(users.router)
app.include_router(products.router)
app.include_router(orders.router)

@app.get("/")
def read_root():
    return {
        "message": "Kenya E-Commerce API",
        "status": "running",
        "docs": "/docs",
        "database": "postgresql" if "postgresql" in str(DATABASE_URL) else "sqlite"
    }

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database_type": "postgresql" if "postgresql" in str(DATABASE_URL) else "sqlite",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/debug/database")
def debug_database():
    """Debug database connection"""
    url_display = str(DATABASE_URL)
    if "@" in url_display:
        parts = url_display.split("@")
        url_display = parts[0].split(":")[0] + ":****@" + parts[1]
    
    is_pg = "postgresql" in str(DATABASE_URL)
    
    return {
        "database_url_set": os.getenv("DATABASE_URL") is not None,
        "database_url": url_display,
        "is_postgresql": is_pg,
        "is_sqlite": not is_pg,
        "persistent_storage": is_pg,
        "warning": None if is_pg else "WARNING: Using SQLite - data will be lost on server restart!",
        "solution": None if is_pg else "Set DATABASE_URL environment variable to use PostgreSQL"
    }

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"❌ ERROR: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "error": str(exc)}
    )