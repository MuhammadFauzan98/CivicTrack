# models/models.py
from extensions import db
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_government = db.Column(db.Boolean, default=False)
    govt_official_id = db.Column(db.String(100), unique=True, nullable=True)  # Government ID for verification
    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Explicit relationships (avoid ambiguity when there are multiple FKs to users)
    complaints_reported = db.relationship(
        'Complaint',
        back_populates='reporter',
        foreign_keys='Complaint.user_id',
        lazy='dynamic',
        cascade='all, delete-orphan'
    )

    assigned_complaints = db.relationship(
        'Complaint',
        back_populates='assignee',
        foreign_keys='Complaint.assigned_to',
        lazy='dynamic'
    )

    feedbacks = db.relationship(
        'Feedback',
        back_populates='submitter',
        foreign_keys='Feedback.submitted_by',
        lazy='dynamic'
    )
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def __repr__(self):
        return f'<User {self.username}>'


class Department(db.Model):
    __tablename__ = 'departments'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    description = db.Column(db.Text)
    
    complaints = db.relationship('Complaint', back_populates='department', lazy='dynamic')
    users = db.relationship('User', backref='department', lazy='dynamic')
    
    def __repr__(self):
        return f'<Department {self.name}>'


class Complaint(db.Model):
    __tablename__ = 'complaints'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    address = db.Column(db.String(200))
    image_path = db.Column(db.String(300))
    status = db.Column(db.String(20), default='Pending')  # Pending, In Progress, Resolved, Rejected
    priority = db.Column(db.String(20), default='Medium')  # Low, Medium, High, Critical

    # reporter (the user who filed the complaint)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    # assignee (government user assigned to handle it) - nullable
    assigned_to = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    department_id = db.Column(db.Integer, db.ForeignKey('departments.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    
    # Relationships: specify which FK each relationship uses
    reporter = db.relationship(
        'User',
        back_populates='complaints_reported',
        foreign_keys=[user_id]
    )

    assignee = db.relationship(
        'User',
        back_populates='assigned_complaints',
        foreign_keys=[assigned_to]
    )

    department = db.relationship('Department', back_populates='complaints')

    feedback = db.relationship('Feedback', back_populates='complaint', lazy='select', uselist=False)
    
    def __repr__(self):
        return f'<Complaint {self.title}>'


class Feedback(db.Model):
    __tablename__ = 'feedbacks'
    
    id = db.Column(db.Integer, primary_key=True)
    complaint_id = db.Column(db.Integer, db.ForeignKey('complaints.id'), unique=True, nullable=False)
    rating = db.Column(db.Integer)  # 1-5 stars
    comment = db.Column(db.Text)
    submitted_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    complaint = db.relationship('Complaint', back_populates='feedback', foreign_keys=[complaint_id])
    submitter = db.relationship('User', back_populates='feedbacks', foreign_keys=[submitted_by])
    
    def __repr__(self):
        return f'<Feedback for Complaint {self.complaint_id}>'
