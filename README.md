# CivicTrack - Track. Resolve. Improve.

## Project Overview
A full-stack web application for citizens to report urban issues and for government officials to manage them efficiently. The system enhances transparency, accountability, and data-driven decision-making through AI-assisted categorization and real-time analytics.

## Features

### For Citizens:
- Report issues with photos, categories, and geolocation
- Track complaint status in real-time
- Provide feedback on resolved issues
- View interactive maps of reported issues

### For Government Officials:
- Department-wise dashboards
- AI-powered complaint categorization
- Interactive heatmaps and analytics
- Complaint assignment and management
- Performance tracking and reporting

### Technical Features:
- User authentication and authorization
- AI-based classification of issues
- Real-time notifications
- Data visualization with charts and heatmaps
- Responsive design for mobile and desktop

## Tech Stack

### Frontend:
- HTML5, CSS3, JavaScript
- Chart.js for data visualization
- Leaflet.js for maps
- Font Awesome icons

### Backend:
- Flask (Python) web framework
- SQLAlchemy ORM
- SQLite database (can be upgraded to PostgreSQL)

### AI/ML:
- Scikit-learn for text classification
- Custom complaint categorization model

### APIs:
- OpenStreetMap for geocoding
- (Optional) Twilio for SMS alerts

## Installation

### Prerequisites:
- Python 3.8 or higher
- pip (Python package manager)

### Steps:

1. Clone the repository:
```bash
git clone <repository-url>
cd CivicTrack
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
- Windows:
  ```bash
  venv\Scripts\activate
  ```
- macOS/Linux:
  ```bash
  source venv/bin/activate
  ```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Initialize the database:
```bash
python database/init_db.py
```

6. Run the application:
```bash
python app.py
```

7. Open your browser and navigate to:
```
http://localhost:5000
```

## Project Structure

```
CivicTrack/
│
├── app.py                      # Main application entry point
├── config.py                   # Configuration settings
├── extensions.py               # Flask extensions initialization
├── requirements.txt            # Python dependencies
│
├── database/
│   └── init_db.py             # Database initialization and seeding
│
├── models/
│   └── models.py              # SQLAlchemy database models
│
├── routes/
│   ├── admin.py               # Admin dashboard routes
│   ├── auth.py                # Authentication routes
│   ├── complaints.py          # Complaint management routes
│   └── forms.py               # WTForms for validation
│
├── static/
│   ├── css/
│   │   └── style.css          # Custom styles
│   ├── js/
│   │   ├── dashboard.js       # Dashboard functionality
│   │   ├── main.js            # Main JavaScript
│   │   ├── map.js             # Map integration
│   │   └── utils.js           # Utility functions
│   └── uploads/               # User-uploaded files
│
├── templates/                  # HTML templates
│   ├── layout.html            # Base template
│   ├── index.html             # Landing page
│   ├── login.html             # Login page
│   ├── register.html          # Registration page
│   ├── dashboard.html         # User dashboard
│   ├── admin_dashboard.html   # Admin dashboard
│   ├── complaint_form.html    # Report complaint form
│   ├── view_complaint.html    # View complaint details
│   ├── manage_complaint.html  # Admin complaint management
│   ├── analytics.html         # Analytics page
│   ├── features.html          # Features page
│   ├── 404.html               # Not found error
│   └── 500.html               # Server error
│
└── utils/
    ├── ai_classifier.py       # AI-based complaint classification
    └── helpers.py             # Helper functions

```

## Configuration

Create a `.env` file in the root directory (optional):

```env
SECRET_KEY=your-secret-key-here
DATABASE_URI=sqlite:///civictrack.db
UPLOAD_FOLDER=static/uploads
MAX_CONTENT_LENGTH=16777216
```

Or modify `config.py` directly for custom configuration.

## Usage

### For Citizens:

1. **Register an Account**: Create an account with your email and password
2. **Login**: Access your dashboard
3. **Report an Issue**: 
   - Click "Report Complaint"
   - Fill in the complaint form with description, category, and location
   - Upload photos (optional)
   - Submit the complaint
4. **Track Status**: Monitor your complaint status in real-time from your dashboard
5. **Provide Feedback**: Rate resolved complaints

### For Admins/Officials:

1. **Login**: Use admin credentials to access the admin dashboard
2. **View Dashboard**: See all complaints with filtering options
3. **Manage Complaints**: 
   - Assign complaints to departments
   - Update complaint status
   - Add comments and notes
4. **View Analytics**: 
   - Analyze complaint trends
   - View heatmaps of issues
   - Generate reports

## Database Models

### User
- User authentication and profile management
- Roles: Citizen, Admin

### Complaint
- Complaint details (title, description, category, location)
- Status tracking (Pending, In Progress, Resolved, Rejected)
- Image attachments
- Timestamps

### Comment
- Comments on complaints
- Linked to users and complaints

## API Endpoints

### Authentication
- `POST /register` - User registration
- `POST /login` - User login
- `GET /logout` - User logout

### Complaints
- `GET /dashboard` - User dashboard
- `GET /complaint/new` - Complaint form
- `POST /complaint/new` - Submit complaint
- `GET /complaint/<id>` - View complaint details
- `POST /complaint/<id>/update` - Update complaint (Admin)

### Admin
- `GET /admin/dashboard` - Admin dashboard
- `GET /admin/analytics` - Analytics page
- `POST /admin/complaint/<id>/assign` - Assign complaint

## Features in Detail

### AI-Powered Classification
The application uses machine learning to automatically categorize complaints into:
- Infrastructure
- Sanitation
- Public Safety
- Utilities
- Transportation
- Environment
- Others

### Interactive Maps
- View all complaints on an interactive map
- Heatmap visualization of complaint density
- Geolocation-based reporting

### Analytics Dashboard
- Complaint trends over time
- Category-wise distribution
- Status tracking
- Performance metrics
- Department-wise analysis

## Security Features

- Password hashing with Werkzeug security
- CSRF protection with Flask-WTF
- Login required decorators
- Role-based access control
- Secure file uploads with validation

## Development

### Running in Development Mode:
```bash
export FLASK_ENV=development  # Linux/Mac
set FLASK_ENV=development     # Windows
python app.py
```

### Database Migrations:
To reset the database:
```bash
python database/init_db.py
```

## Testing

Run tests (if implemented):
```bash
python -m pytest tests/
```

## Deployment

### Production Considerations:
1. Use PostgreSQL instead of SQLite
2. Set strong SECRET_KEY in environment variables
3. Enable HTTPS
4. Configure proper logging
5. Use a production WSGI server (Gunicorn, uWSGI)
6. Set up proper backup strategy

### Example with Gunicorn:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 "app:create_app()"
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Future Enhancements

- [ ] Real-time notifications via WebSockets
- [ ] SMS/Email alerts for status updates
- [ ] Mobile application (React Native/Flutter)
- [ ] Advanced analytics with predictive models
- [ ] Multi-language support
- [ ] API for third-party integrations
- [ ] Chat support for complaint discussions
- [ ] Integration with government databases

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contact

For questions or support, please contact:
- Email: support@civictrack.com
- GitHub Issues: [Create an issue](../../issues)

## Acknowledgments

- Flask community for excellent documentation
- OpenStreetMap for map data
- Chart.js for visualization tools
- All contributors who helped improve this project

---

**CivicTrack** - Empowering citizens, enabling governments, building better communities.
