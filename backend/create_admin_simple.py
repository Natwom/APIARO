import sys
sys.path.append('.')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User

engine = create_engine('sqlite:///./kenya_ecommerce.db', connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
db = Session()

existing = db.query(User).filter_by(email='admin@kenyashop.co.ke').first()
if existing:
    print("Admin already exists!")
    print(f"Email: {existing.email}")
else:
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
