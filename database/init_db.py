# database/init_db.py
"""
Initialize database and seed basic data (admin user, citizen user, departments).
Run from project root: python database/init_db.py
"""

import os
import sys
import traceback

# Ensure project root on sys.path so imports work when running the script directly
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app import create_app, db

# Import models - adjust if your models are located elsewhere
from models.models import User, Department, Complaint, Feedback

# Security: allow admin password to be provided by env var for non-dev usage
ADMIN_USERNAME = os.environ.get('SMARTCITY_ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('SMARTCITY_ADMIN_PASS', 'admin123')
CITIZEN_USERNAME = os.environ.get('SMARTCITY_CITIZEN_USER', 'citizen')
CITIZEN_PASSWORD = os.environ.get('SMARTCITY_CITIZEN_PASS', 'citizen123')

def safe_set_password(user, plain_password):
    """
    Helper to set password. Prefer user.set_password if available; otherwise use werkzeug.
    """
    try:
        if hasattr(user, 'set_password') and callable(user.set_password):
            user.set_password(plain_password)
        else:
            # fallback
            from werkzeug.security import generate_password_hash
            user.password_hash = generate_password_hash(plain_password)
    except Exception:
        # last resort: set attribute directly (not recommended for prod)
        try:
            from werkzeug.security import generate_password_hash
            user.password_hash = generate_password_hash(plain_password)
        except Exception:
            pass

def init_database():
    app = create_app()

    with app.app_context():
        try:
            print("Creating database tables (if not present)...")
            db.create_all()

            # Create default admin user if not exists
            if not User.query.filter_by(username=ADMIN_USERNAME).first():
                admin = User(
                    username=ADMIN_USERNAME,
                    email='admin@smartcity.gov',
                    is_admin=True,
                    is_government=True
                )
                safe_set_password(admin, ADMIN_PASSWORD)
                db.session.add(admin)
                print(f"Created admin user '{ADMIN_USERNAME}'")
            else:
                print(f"Admin user '{ADMIN_USERNAME}' already exists")

            # Create default citizen user
            if not User.query.filter_by(username=CITIZEN_USERNAME).first():
                citizen = User(
                    username=CITIZEN_USERNAME,
                    email='citizen@example.com',
                    is_admin=False,
                    is_government=False
                )
                safe_set_password(citizen, CITIZEN_PASSWORD)
                db.session.add(citizen)
                print(f"Created citizen user '{CITIZEN_USERNAME}'")
            else:
                print(f"Citizen user '{CITIZEN_USERNAME}' already exists")

            # Create default departments if they don't exist
            if not Department.query.first():
                default_depts = [
                    Department(name='Roads and Infrastructure', email='roads@city.gov',
                              description='Handles road repairs, potholes, and infrastructure issues'),
                    Department(name='Sanitation and Waste', email='sanitation@city.gov',
                              description='Manages garbage collection, drainage, and sanitation issues'),
                    Department(name='Electricity Department', email='electricity@city.gov',
                              description='Addresses power outages and electrical infrastructure problems'),
                    Department(name='Water Supply', email='water@city.gov',
                              description='Handles water supply, quality, and distribution issues'),
                    Department(name='Street Lighting', email='lighting@city.gov',
                              description='Manages streetlight repairs and maintenance'),
                    Department(name='Emergency Services', email='emergency@city.gov',
                              description='Coordinates emergency responses and critical issues')
                ]
                db.session.bulk_save_objects(default_depts)
                print("Seeded default departments")
            else:
                print("Departments already exist")

            db.session.commit()
            print("Database initialized successfully!")
            print(f"Admin credentials: {ADMIN_USERNAME} / (hidden - use env SMARTCITY_ADMIN_PASS to override)")
            print(f"Citizen credentials: {CITIZEN_USERNAME} / (hidden - use env SMARTCITY_CITIZEN_PASS to override)")

        except Exception as ex:
            print("Error initializing database:")
            traceback.print_exc()
            try:
                db.session.rollback()
            except Exception:
                pass
            raise

if __name__ == '__main__':
    init_database()
