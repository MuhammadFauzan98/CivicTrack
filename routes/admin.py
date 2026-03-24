from flask import Blueprint, render_template, redirect, url_for, flash, request, jsonify, make_response
from flask_login import login_required, current_user
from extensions import db
from models.models import Complaint, User, Department, Feedback
from datetime import datetime, timedelta
import io

admin_bp = Blueprint('admin', __name__)

@admin_bp.before_request
def restrict_to_admin():
    if not current_user.is_authenticated or not (current_user.is_admin or current_user.is_government):
        flash('Access denied. Admin privileges required.', 'danger')
        return redirect(url_for('index'))

@admin_bp.route('/admin')
@login_required
def admin_dashboard():
    # Get complaints (recent for table + all for accurate statistics)
    complaints = Complaint.query.order_by(Complaint.created_at.desc()).limit(50).all()
    all_complaints = Complaint.query.all()

    # Statistics
    total_complaints = len(all_complaints)
    pending_complaints = len([c for c in all_complaints if c.status == 'Pending'])
    in_progress_complaints = len([c for c in all_complaints if c.status == 'In Progress'])
    resolved_complaints = len([c for c in all_complaints if c.status == 'Resolved'])

    # Department-wise counts (include unassigned complaints as well)
    dept_counts = {}
    for complaint in all_complaints:
        dept_name = complaint.department.name if complaint.department else 'Unassigned'
        dept_counts[dept_name] = dept_counts.get(dept_name, 0) + 1

    # Ensure all departments appear even when they currently have zero complaints.
    for dept in Department.query.all():
        dept_counts.setdefault(dept.name, 0)

    dept_stats = [
        {'name': dept_name, 'count': count}
        for dept_name, count in dept_counts.items()
    ]

    dept_stats.sort(key=lambda item: item['name'] != 'Unassigned')
    
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

        elif action == 'assign_staff':
            assigned_to = request.form.get('assigned_to')
            if assigned_to:
                staff_user = User.query.filter_by(id=assigned_to, is_government=True).first()
                if staff_user:
                    complaint.assigned_to = staff_user.id
                    db.session.commit()
                    flash(f'Complaint assigned to {staff_user.username}', 'success')
                else:
                    flash('Selected staff member is invalid.', 'danger')
            else:
                complaint.assigned_to = None
                db.session.commit()
                flash('Staff assignment cleared.', 'info')
    
    departments = Department.query.all()
    government_users = User.query.filter_by(is_government=True).all()
    
    return render_template('manage_complaint.html',
                          complaint=complaint,
                          departments=departments,
                          government_users=government_users)

@admin_bp.route('/admin/analytics')
@login_required
def analytics():
    complaints = Complaint.query.all()

    # Get data for charts
    complaints_by_category = db.session.query(
        Complaint.category,
        db.func.count(Complaint.id)
    ).group_by(Complaint.category).all()
    
    complaints_by_status = db.session.query(
        Complaint.status,
        db.func.count(Complaint.id)
    ).group_by(Complaint.status).all()

    # Build monthly trend in Python for DB portability.
    monthly_counts = {}
    for comp in complaints:
        month_key = comp.created_at.strftime('%Y-%m')
        monthly_counts[month_key] = monthly_counts.get(month_key, 0) + 1

    complaints_by_month = sorted(monthly_counts.items(), key=lambda x: x[0])
    
    # Prepare data for JSON response
    category_data = [{'category': cat, 'count': cnt} for cat, cnt in complaints_by_category]
    status_data = [{'status': stat, 'count': cnt} for stat, cnt in complaints_by_status]
    monthly_data = [{'month': month, 'count': cnt} for month, cnt in complaints_by_month]

    # Department performance chart data.
    dept_performance = []
    departments = Department.query.all()
    for dept in departments:
        count = Complaint.query.filter_by(department_id=dept.id).count()
        dept_performance.append({'department': dept.name, 'count': count})
    
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

    total_count = len(complaints)
    resolved_count = len([c for c in complaints if c.status == 'Resolved'])
    resolution_rate = round((resolved_count / total_count * 100), 1) if total_count else 0
    active_citizens = len({c.user_id for c in complaints if c.user_id})

    ratings = [fb.rating for fb in Feedback.query.filter(Feedback.rating.isnot(None)).all()]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0
    
    return render_template('analytics.html',
                          category_data=category_data,
                          status_data=status_data,
                          monthly_data=monthly_data,
                          heatmap_data=heatmap_data,
                          dept_performance=dept_performance,
                          resolution_rate=resolution_rate,
                          active_citizens=active_citizens,
                          avg_rating=avg_rating)

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
    
    total_complaints = Complaint.query.count()
    resolved_count = Complaint.query.filter_by(status='Resolved').count()
    resolution_rate = round((resolved_count / total_complaints * 100), 1) if total_complaints else 0

    active_citizens = db.session.query(Complaint.user_id).distinct().count()

    ratings = [fb.rating for fb in Feedback.query.filter(Feedback.rating.isnot(None)).all()]
    avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0

    # Category distribution for current month (Python-side for portability)
    now = datetime.now()
    current_month = now.month
    current_year = now.year
    monthly_categories = {}
    current_month_complaints = Complaint.query.all()
    for comp in current_month_complaints:
        if comp.created_at.month == current_month and comp.created_at.year == current_year:
            monthly_categories[comp.category] = monthly_categories.get(comp.category, 0) + 1
    
    return jsonify({
        'avg_resolution_time': round(avg_resolution_time, 1),
        'resolution_rate': resolution_rate,
        'active_citizens': active_citizens,
        'avg_rating': avg_rating,
        'monthly_categories': monthly_categories
    })

@admin_bp.route('/admin/export/pdf')
@login_required
def export_pdf():
    """Export recent complaints to PDF"""
    try:
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import letter, landscape
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        
        # Get complaints data
        complaints = Complaint.query.order_by(Complaint.created_at.desc()).limit(50).all()
        
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
            alignment=1  # Center
        )
        title = Paragraph("CivicTrack - Recent Complaints Report", title_style)
        elements.append(title)
        
        # Add generation date
        date_style = ParagraphStyle(
            'DateStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.gray,
            spaceAfter=20,
            alignment=1
        )
        date_text = Paragraph(f"Generated on: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}", date_style)
        elements.append(date_text)
        elements.append(Spacer(1, 0.2*inch))
        
        # Prepare table data
        data = [['ID', 'Title', 'Category', 'Status', 'Priority', 'Department', 'Date']]
        
        for complaint in complaints:
            dept_name = complaint.department.name if complaint.department else 'Unassigned'
            title_text = complaint.title[:40] + '...' if len(complaint.title) > 40 else complaint.title
            
            data.append([
                f'#{complaint.id}',
                title_text,
                complaint.category.replace('_', ' ').title(),
                complaint.status,
                complaint.priority,
                dept_name[:20],
                complaint.created_at.strftime('%Y-%m-%d')
            ])
        
        # Create table
        table = Table(data, colWidths=[0.6*inch, 2.2*inch, 1.2*inch, 1*inch, 0.9*inch, 1.5*inch, 1*inch])
        
        # Style the table
        table.setStyle(TableStyle([
            # Header styling
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            
            # Body styling
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 1), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
        ]))
        
        elements.append(table)
        
        # Build PDF
        doc.build(elements)
        
        # Get PDF data
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Create response
        response = make_response(pdf_data)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename=complaints_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.pdf'
        
        return response
        
    except ImportError:
        flash('PDF generation requires reportlab library. Install it with: pip install reportlab', 'danger')
        return redirect(url_for('admin.admin_dashboard'))
    except Exception as e:
        flash(f'Error generating PDF: {str(e)}', 'danger')
        return redirect(url_for('admin.admin_dashboard'))