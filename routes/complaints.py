from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, current_app
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import os
from app import db
from models.models import Complaint, Feedback, Department
from routes.forms import ComplaintForm, FeedbackForm
from datetime import datetime
import uuid

complaints_bp = Blueprint('complaints', __name__)

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

@complaints_bp.route('/dashboard')
@login_required
def dashboard():
    user_complaints = Complaint.query.filter_by(user_id=current_user.id)\
        .order_by(Complaint.created_at.desc()).all()
    
    # Get stats for dashboard
    total = len(user_complaints)
    pending = len([c for c in user_complaints if c.status == 'Pending'])
    in_progress = len([c for c in user_complaints if c.status == 'In Progress'])
    resolved = len([c for c in user_complaints if c.status == 'Resolved'])
    
    return render_template('dashboard.html', 
                          complaints=user_complaints,
                          total=total,
                          pending=pending,
                          in_progress=in_progress,
                          resolved=resolved)

@complaints_bp.route('/complaint/new', methods=['GET', 'POST'])
@login_required
def new_complaint():
    form = ComplaintForm()
    
    if form.validate_on_submit():
        # Determine department based on category
        category_dept_map = {
            'potholes': 'Roads and Infrastructure',
            'garbage': 'Sanitation and Waste',
            'streetlight': 'Street Lighting',
            'water': 'Water Supply',
            'electricity': 'Electricity Department',
            'drainage': 'Sanitation and Waste',
            'traffic': 'Roads and Infrastructure',
            'other': 'Emergency Services'
        }
        
        dept_name = category_dept_map.get(form.category.data, 'Emergency Services')
        department = Department.query.filter_by(name=dept_name).first()
        
        complaint = Complaint(
            title=form.title.data,
            description=form.description.data,
            category=form.category.data,
            address=form.address.data,
            latitude=form.latitude.data,
            longitude=form.longitude.data,
            user_id=current_user.id,
            department_id=department.id if department else None,
            priority='Medium'  # AI would determine this in production
        )
        
        # Handle image upload
        if form.image.data:
            filename = secure_filename(form.image.data.filename)
            # Add unique identifier to avoid name collisions
            unique_filename = f"{uuid.uuid4().hex}_{filename}"
            filepath = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
            form.image.data.save(filepath)
            complaint.image_path = f"uploads/{unique_filename}"
        
        db.session.add(complaint)
        db.session.commit()
        
        flash('Complaint submitted successfully!', 'success')
        return redirect(url_for('complaints.dashboard'))
    
    return render_template('complaint_form.html', form=form, title='New Complaint')

@complaints_bp.route('/complaint/<int:id>')
@login_required
def view_complaint(id):
    complaint = Complaint.query.get_or_404(id)
    
    # Check if user owns this complaint or is admin/government
    if complaint.user_id != current_user.id and not (current_user.is_admin or current_user.is_government):
        flash('You do not have permission to view this complaint.', 'danger')
        return redirect(url_for('complaints.dashboard'))
    
    feedback_form = FeedbackForm() if not complaint.feedback and complaint.status == 'Resolved' else None
    
    return render_template('view_complaint.html', 
                          complaint=complaint,
                          feedback_form=feedback_form)

@complaints_bp.route('/complaint/<int:id>/feedback', methods=['POST'])
@login_required
def submit_feedback(id):
    complaint = Complaint.query.get_or_404(id)
    
    if complaint.user_id != current_user.id:
        flash('You can only provide feedback for your own complaints.', 'danger')
        return redirect(url_for('complaints.dashboard'))
    
    if complaint.status != 'Resolved':
        flash('You can only provide feedback for resolved complaints.', 'danger')
        return redirect(url_for('complaints.view_complaint', id=id))
    
    if complaint.feedback:
        flash('Feedback already submitted for this complaint.', 'info')
        return redirect(url_for('complaints.view_complaint', id=id))
    
    form = FeedbackForm()
    if form.validate_on_submit():
        feedback = Feedback(
            complaint_id=id,
            rating=int(form.rating.data),
            comment=form.comment.data,
            submitted_by=current_user.id
        )
        
        db.session.add(feedback)
        db.session.commit()
        
        flash('Thank you for your feedback!', 'success')
    
    return redirect(url_for('complaints.view_complaint', id=id))

@complaints_bp.route('/api/complaints')
@login_required
def get_complaints_api():
    # For map visualization
    if current_user.is_admin or current_user.is_government:
        complaints = Complaint.query.all()
    else:
        complaints = Complaint.query.filter_by(user_id=current_user.id).all()
    
    complaints_data = []
    for complaint in complaints:
        complaints_data.append({
            'id': complaint.id,
            'title': complaint.title,
            'category': complaint.category,
            'latitude': complaint.latitude,
            'longitude': complaint.longitude,
            'status': complaint.status,
            'priority': complaint.priority,
            'address': complaint.address,
            'created_at': complaint.created_at.strftime('%Y-%m-%d')
        })
    
    return jsonify(complaints_data)