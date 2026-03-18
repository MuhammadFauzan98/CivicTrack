from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, current_app, make_response
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import os
import io
from extensions import db
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

@complaints_bp.route('/complaints/map')
@login_required
def complaints_map():
    """Display all user complaints on a full map page"""
    return render_template('complaints_map.html')

@complaints_bp.route('/complaints/export/pdf')
@login_required
def export_user_complaints_pdf():
    """Export user's complaints to PDF"""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        
        # Get user's complaints
        complaints = Complaint.query.filter_by(user_id=current_user.id) \
            .order_by(Complaint.created_at.desc()).all()
        
        if not complaints:
            flash('No complaints to export.', 'warning')
            return redirect(url_for('complaints.dashboard'))
        
        # Create PDF in memory
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter), 
                              rightMargin=30, leftMargin=30,
                              topMargin=30, bottomMargin=30)
        
        # Container for PDF elements
        elements = []
        styles = getSampleStyleSheet()
        
        # Add title
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#2c3e50'),
            spaceAfter=30,
            alignment=1
        )
        title = Paragraph(f'My Complaints Report - {current_user.username}', title_style)
        elements.append(title)
        
        # Add summary
        summary_text = f'<b>Generated:</b> {datetime.now().strftime("%Y-%m-%d %H:%M")}<br/>' \
                      f'<b>Total Complaints:</b> {len(complaints)}<br/>' \
                      f'<b>Resolved:</b> {len([c for c in complaints if c.status == "Resolved"])}<br/>' \
                      f'<b>In Progress:</b> {len([c for c in complaints if c.status == "In Progress"])}<br/>' \
                      f'<b>Pending:</b> {len([c for c in complaints if c.status == "Pending"])}'
        
        summary = Paragraph(summary_text, styles['Normal'])
        elements.append(summary)
        elements.append(Spacer(1, 0.3*inch))
        
        # Create table data
        table_data = [['ID', 'Title', 'Category', 'Status', 'Priority', 'Date', 'Address']]
        
        for complaint in complaints:
            table_data.append([
                str(complaint.id),
                complaint.title[:30] + '...' if len(complaint.title) > 30 else complaint.title,
                complaint.category.title(),
                complaint.status,
                complaint.priority,
                complaint.created_at.strftime('%Y-%m-%d'),
                complaint.address[:20] + '...' if len(complaint.address) > 20 else complaint.address
            ])
        
        # Create table
        table = Table(table_data, colWidths=[0.6*inch, 1.8*inch, 1.2*inch, 1*inch, 1*inch, 1*inch, 1.4*inch])
        
        # Style table
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))
        
        elements.append(table)
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF data
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Return as file
        response = make_response(pdf_data)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=my_complaints_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        
        return response
        
    except ImportError:
        flash('PDF generation requires reportlab library. Install it with: pip install reportlab', 'danger')
        return redirect(url_for('complaints.dashboard'))
    except Exception as e:
        flash(f'Error generating PDF: {str(e)}', 'danger')
        return redirect(url_for('complaints.dashboard'))