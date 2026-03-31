import sys
sys.path.append('.')

# Use SQLite instead of MySQL to avoid bcrypt issues
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User

# Create SQLite engine
engine = create_engine('sqlite:///./kenya_ecommerce.db', connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
db = Session()

# Check if admin exists
existing = db.query(User).filter_by(email='admin@kenyashop.co.ke').first()
if existing:
    print("Admin already exists!")
    print(f"Email: {existing.email}")
else:
    # Create with known bcrypt hash for "admin123"
    # This hash was generated with: bcrypt.hashpw("admin123".encode(), bcrypt.gensalt())
    admin = User(
        email='admin@kenyashop.co.ke',
        password_hash='$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G',
        full_name='System Admin',
        phone_number='+254712345678'
    )
    db.add(admin)
    db.commit()
    print("Admin created successfully!")
    print("Email: admin@kenyashop.co.ke")
    print("Password: admin123")

db.close()