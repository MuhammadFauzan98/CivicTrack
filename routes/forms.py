from flask_wtf import FlaskForm
from flask_wtf.file import FileField, FileAllowed
from wtforms import StringField, PasswordField, BooleanField, SubmitField, TextAreaField, SelectField, FloatField
from wtforms.validators import DataRequired, Email, EqualTo, Length, ValidationError, Optional

class LoginForm(FlaskForm):
    email = StringField('Email', validators=[DataRequired(), Email()])
    password = PasswordField('Password', validators=[DataRequired()])
    remember_me = BooleanField('Remember Me')
    submit = SubmitField('Sign In')

class RegistrationForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=3, max=64)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    user_type = SelectField('User Type', choices=[
        ('citizen', 'Citizen'),
        ('government', 'Government Official')
    ], validators=[DataRequired()])
    govt_official_id = StringField('Government Official ID', validators=[Optional(), Length(min=3, max=100)])
    password = PasswordField('Password', validators=[DataRequired(), Length(min=6)])
    confirm_password = PasswordField('Confirm Password', 
                                     validators=[DataRequired(), EqualTo('password')])
    submit = SubmitField('Register')
    
    # Lazy imports to avoid DB access during module import (prevents "app not registered" errors)
    def validate_username(self, username):
        from models.models import User
        user = User.query.filter_by(username=username.data).first()
        if user is not None:
            raise ValidationError('Username already exists.')
    
    def validate_email(self, email):
        from models.models import User
        user = User.query.filter_by(email=email.data).first()
        if user is not None:
            raise ValidationError('Email already registered.')
    
    def validate_govt_official_id(self, govt_official_id):
        # Only validate if user selected government official and provided an ID
        if self.user_type.data == 'government':
            if not govt_official_id.data:
                raise ValidationError('Government Official ID is required for government officials.')
            from models.models import User
            user = User.query.filter_by(govt_official_id=govt_official_id.data).first()
            if user is not None:
                raise ValidationError('This Government Official ID is already registered.')

class ComplaintForm(FlaskForm):
    title = StringField('Issue Title', validators=[DataRequired(), Length(max=200)])
    category = SelectField('Category', choices=[
        ('potholes', 'Potholes/Road Damage'),
        ('garbage', 'Garbage Accumulation'),
        ('streetlight', 'Streetlight Failure'),
        ('water', 'Water Supply Issue'),
        ('electricity', 'Electricity Problem'),
        ('drainage', 'Drainage/Sewage'),
        ('traffic', 'Traffic Signal Issue'),
        ('other', 'Other')
    ], validators=[DataRequired()])
    description = TextAreaField('Description', validators=[DataRequired()])
    address = StringField('Address/Location', validators=[DataRequired()])
    latitude = FloatField('Latitude', validators=[DataRequired()])
    longitude = FloatField('Longitude', validators=[DataRequired()])
    image = FileField('Upload Image (Optional)', 
                      validators=[FileAllowed(['jpg', 'jpeg', 'png', 'gif'], 'Images only!')])
    submit = SubmitField('Submit Complaint')

class FeedbackForm(FlaskForm):
    rating = SelectField('Rating', choices=[
        ('1', '1 Star - Very Poor'),
        ('2', '2 Stars - Poor'),
        ('3', '3 Stars - Average'),
        ('4', '4 Stars - Good'),
        ('5', '5 Stars - Excellent')
    ], validators=[DataRequired()])
    comment = TextAreaField('Comments/Suggestions')
    submit = SubmitField('Submit Feedback')
