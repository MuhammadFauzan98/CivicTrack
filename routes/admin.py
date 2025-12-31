from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify
from flask_login import login_required, current_user
from extensions import db
from models.models import Complaint, User, Department, Feedback
from datetime import datetime, timedelta
import json

admin_bp = Blueprint('admin', __name__)

@admin_bp.before_request
def restrict_to_admin():
    if not current_user.is_authenticated or not (current_user.is_admin or current_user.is_government):
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('index'))

@admin_bp.route('/admin')
@login_required
def admin_dashboard():
    # Get all complaints
    complaints = Complaint.query.order_by(Complaint.created_at.desc()).limit(50).all()
    
    # Statistics
    total_complaints = Complaint.query.count()
    pending_complaints = Complaint.query.filter_by(status='Pending').count()
    in_progress_complaints = Complaint.query.filter_by(status='In Progress').count()
    resolved_complaints = Complaint.query.filter_by(status='Resolved').count()
    
    # Department-wise counts
    departments = Department.query.all()
    dept_stats = []
    for dept in departments:
        count = Complaint.query.filter_by(department_id=dept.id).count()
        dept_stats.append({
            'name': dept.name,
            'count': count
        })
    
    # Recent feedback
    recent_feedback = Feedback.query.order_by(Feedback.created_at.desc()).limit(5).all()
    
    return render_template('admin_dashboard.html',
                          complaints=complaints,
                          total=total_complaints,
                          pending=pending_complaints,
                          in_progress=in_progress_complaints,
                          resolved=resolved_complaints,
                          departments=dept_stats,
                          feedback=recent_feedback)

@admin_bp.route('/admin/complaint/<int:id>', methods=['GET', 'POST'])
@login_required
def manage_complaint(id):
    complaint = Complaint.query.get_or_404(id)
    
    if request.method == 'POST':
        action = request.form.get('action')
        
        if action == 'update_status':
            new_status = request.form.get('status')
            complaint.status = new_status
            
            if new_status == 'Resolved':
                complaint.resolved_at = datetime.utcnow()
            elif new_status == 'In Progress':
                # Auto-assign to current admin if not already assigned
                if not complaint.assigned_to:
                    complaint.assigned_to = current_user.id
            
            db.session.commit()
            flash(f'Status updated to {new_status}', 'success')
        
        elif action == 'update_priority':
            new_priority = request.form.get('priority')
            complaint.priority = new_priority
            db.session.commit()
            flash(f'Priority updated to {new_priority}', 'success')
        
        elif action == 'reassign':
            new_dept_id = request.form.get('department_id')
            if new_dept_id:
                complaint.department_id = new_dept_id
                db.session.commit()
                flash('Complaint reassigned', 'success')
    
    departments = Department.query.all()
    government_users = User.query.filter_by(is_government=True).all()
    
    return render_template('manage_complaint.html',
                          complaint=complaint,
                          departments=departments,
                          government_users=government_users)

@admin_bp.route('/admin/analytics')
@login_required
def analytics():
    # Get data for charts
    complaints_by_category = db.session.query(
        Complaint.category,
        db.func.count(Complaint.id)
    ).group_by(Complaint.category).all()
    
    complaints_by_status = db.session.query(
        Complaint.status,
        db.func.count(Complaint.id)
    ).group_by(Complaint.status).all()
    
    complaints_by_month = db.session.query(
        db.func.strftime('%Y-%m', Complaint.created_at),
        db.func.count(Complaint.id)
    ).group_by(db.func.strftime('%Y-%m', Complaint.created_at))\
     .order_by(db.func.strftime('%Y-%m', Complaint.created_at)).all()
    
    # Prepare data for JSON response
    category_data = [{'category': cat, 'count': cnt} for cat, cnt in complaints_by_category]
    status_data = [{'status': stat, 'count': cnt} for stat, cnt in complaints_by_status]
    monthly_data = [{'month': month, 'count': cnt} for month, cnt in complaints_by_month]
    
    # Get heatmap data (all complaints with coordinates)
    heatmap_data = []
    complaints_with_coords = Complaint.query.filter(
        Complaint.latitude.isnot(None),
        Complaint.longitude.isnot(None)
    ).all()
    
    for comp in complaints_with_coords:
        heatmap_data.append({
            'lat': comp.latitude,
            'lng': comp.longitude,
            'weight': 1 if comp.priority == 'Low' else 2 if comp.priority == 'Medium' else 3 if comp.priority == 'High' else 4,
            'category': comp.category,
            'title': comp.title
        })
    
    return render_template('analytics.html',
                          category_data=json.dumps(category_data),
                          status_data=json.dumps(status_data),
                          monthly_data=json.dumps(monthly_data),
                          heatmap_data=json.dumps(heatmap_data))

@admin_bp.route('/admin/api/analytics')
@login_required
def analytics_api():
    # Return JSON data for AJAX requests
    # Calculate resolution time
    resolved_complaints = Complaint.query.filter(
        Complaint.status == 'Resolved',
        Complaint.resolved_at.isnot(None)
    ).all()
    
    resolution_times = []
    for comp in resolved_complaints:
        if comp.resolved_at and comp.created_at:
            days = (comp.resolved_at - comp.created_at).days
            resolution_times.append(days)
    
    avg_resolution_time = sum(resolution_times) / len(resolution_times) if resolution_times else 0
    
    # Category distribution for current month
    from datetime import datetime
    current_month = datetime.now().strftime('%Y-%m')
    monthly_categories = db.session.query(
        Complaint.category,
        db.func.count(Complaint.id)
    ).filter(db.func.strftime('%Y-%m', Complaint.created_at) == current_month)\
     .group_by(Complaint.category).all()
    
    return jsonify({
        'avg_resolution_time': round(avg_resolution_time, 1),
        'monthly_categories': dict(monthly_categories)
    })