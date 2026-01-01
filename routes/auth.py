from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app
from flask_login import login_user, logout_user, login_required, current_user
from urllib.parse import urlparse
from extensions import db
from models.models import User
from routes.forms import LoginForm, RegistrationForm

auth_bp = Blueprint('auth', __name__)

def safe_url_for(*endpoint_candidates, **values):
    """
    Try to build a URL for each endpoint in order; return first that works.
    If none succeed, fall back to 'index'.
    """
    for ep in endpoint_candidates:
        try:
            return url_for(ep, **values)
        except Exception:
            continue
    return url_for('index')

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # If user is already authenticated, redirect to appropriate dashboard
    if current_user.is_authenticated:
        if current_user.is_admin or current_user.is_government:
            return redirect(safe_url_for('admin.dashboard', 'complaints.dashboard', 'dashboard'))
        else:
            return redirect(safe_url_for('complaints.dashboard', 'dashboard'))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user is None or not user.check_password(form.password.data):
            flash('Invalid email or password', 'danger')
            return redirect(url_for('auth.login'))

        login_user(user, remember=form.remember_me.data)
        next_page = request.args.get('next')

        # Validate 'next' — must be a relative URL (no netloc)
        if not next_page or urlparse(next_page).netloc != '':
            # Redirect based on user type
            if user.is_admin or user.is_government:
                next_page = safe_url_for('admin.dashboard', 'complaints.dashboard', 'dashboard')
            else:
                next_page = safe_url_for('complaints.dashboard', 'dashboard')

        return redirect(next_page)

    return render_template('login.html', form=form, title='Login')

@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        if current_user.is_admin or current_user.is_government:
            return redirect(safe_url_for('admin.dashboard', 'complaints.dashboard', 'dashboard'))
        else:
            return redirect(safe_url_for('complaints.dashboard', 'dashboard'))

    form = RegistrationForm()
    if form.validate_on_submit():
        user = User(
            username=form.username.data,
            email=form.email.data,
            is_government=form.user_type.data == 'government',
            govt_official_id=form.govt_official_id.data if form.user_type.data == 'government' else None
        )
        user.set_password(form.password.data)

        db.session.add(user)
        db.session.commit()

        flash('Registration successful! Please login.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('register.html', form=form, title='Register')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))
