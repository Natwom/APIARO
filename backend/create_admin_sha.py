import sys
sys.path.append('.')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.models import Base, User
import hashlib

engine = create_engine('sqlite:///./kenya_ecommerce.db', connect_args={"check_same_thread": False})
Base.metadata.create_all(engine)

Session = sessionmaker(bind=engine)
db = Session()

# Delete existing admin
existing = db.query(User).filter_by(email='admin@kenyashop.co.ke').first()
if existing:
    db.delete(existing)
    db.commit()
    print("Deleted old admin")

# Create with SHA256 hash
password_hash = hashlib.sha256("admin123".encode()).hexdigest()
admin = User(
    email='admin@kenyashop.co.ke',
    password_hash=password_hash,
    full_name='System Admin',
    phone_number='+254712345678'
)
db.add(admin)
db.commit()
print("Admin created with SHA256!")
print("Email: admin@kenyashop.co.ke")
print("Password: admin123")

db.close()
