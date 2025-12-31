import os
import random
import string
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from PIL import Image
import io

def allowed_file(filename, allowed_extensions=None):
    """Check if file extension is allowed"""
    if allowed_extensions is None:
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

def generate_unique_filename(filename):
    """Generate a unique filename to avoid collisions"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    name, ext = os.path.splitext(filename)
    return f"{name}_{timestamp}_{random_str}{ext}"

def save_uploaded_file(file, upload_folder, max_size=(1024, 1024)):
    """
    Save uploaded file with compression and resizing
    
    Args:
        file: FileStorage object
        upload_folder: Directory to save file
        max_size: Maximum dimensions (width, height)
    
    Returns:
        str: Saved filename or None if error
    """
    if not file or not allowed_file(file.filename):
        return None
    
    try:
        # Generate secure filename
        filename = secure_filename(file.filename)
        unique_filename = generate_unique_filename(filename)
        filepath = os.path.join(upload_folder, unique_filename)
        
        # Open and process image
        img = Image.open(file)
        
        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'RGBA':
                background.paste(img, mask=img.split()[3])  # 3 is the alpha channel
            else:
                background.paste(img, mask=img.split()[1])  # 1 is the alpha channel
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # Resize if too large
        if img.size[0] > max_size[0] or img.size[1] > max_size[1]:
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save with compression
        img.save(filepath, 'JPEG', quality=85, optimize=True)
        
        return unique_filename
        
    except Exception as e:
        print(f"Error processing image: {e}")
        return None

def calculate_resolution_time(created_at, resolved_at):
    """Calculate resolution time in days"""
    if not resolved_at:
        return None
    return (resolved_at - created_at).days

def generate_complaint_id():
    """Generate a unique complaint ID"""
    timestamp = datetime.now().strftime('%y%m%d')
    random_num = random.randint(1000, 9999)
    return f"SC{timestamp}{random_num}"

def format_date(date_obj, format_str='%Y-%m-%d %H:%M'):
    """Format datetime object to string"""
    if not date_obj:
        return ''
    return date_obj.strftime(format_str)

def parse_date(date_str, format_str='%Y-%m-%d'):
    """Parse string to datetime object"""
    try:
        return datetime.strptime(date_str, format_str)
    except (ValueError, TypeError):
        return None

def validate_coordinates(lat, lng):
    """Validate latitude and longitude coordinates"""
    try:
        lat = float(lat)
        lng = float(lng)
        return -90 <= lat <= 90 and -180 <= lng <= 180
    except (ValueError, TypeError):
        return False

def get_date_range(days=30):
    """Get date range for last N days"""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=days)
    return start_date, end_date

def calculate_percentage(part, whole):
    """Calculate percentage"""
    if whole == 0:
        return 0
    return round((part / whole) * 100, 1)

def truncate_text(text, max_length=100):
    """Truncate text to specified length"""
    if len(text) <= max_length:
        return text
    return text[:max_length] + '...'

def generate_color_from_category(category):
    """Generate consistent color for category"""
    colors = {
        'potholes': '#FF6384',       # Red
        'garbage': '#36A2EB',        # Blue
        'streetlight': '#FFCE56',    # Yellow
        'water': '#4BC0C0',          # Teal
        'electricity': '#9966FF',    # Purple
        'drainage': '#FF9F40',       # Orange
        'traffic': '#8AC926',        # Green
        'other': '#1982C4'           # Dark Blue
    }
    return colors.get(category, '#CCCCCC')

def prioritize_complaint(category, description):
    """
    Simple AI-based prioritization
    In production, this would use ML models
    """
    priority_keywords = {
        'Critical': ['emergency', 'urgent', 'danger', 'accident', 'flood', 'fire', 'collapse'],
        'High': ['broken', 'leak', 'outage', 'blocked', 'overflow', 'hazard'],
        'Medium': ['damage', 'problem', 'issue', 'not working', 'need repair'],
        'Low': ['minor', 'small', 'maintenance', 'cleanup']
    }
    
    text = f"{category} {description}".lower()
    
    for priority, keywords in priority_keywords.items():
        for keyword in keywords:
            if keyword in text:
                return priority
    
    return 'Medium'  # Default priority

def validate_email(email):
    """Simple email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def generate_password():
    """Generate a random password"""
    chars = string.ascii_letters + string.digits + '!@#$%^&*'
    return ''.join(random.choice(chars) for _ in range(12))

def get_file_size(file_path):
    """Get file size in human readable format"""
    try:
        size = os.path.getsize(file_path)
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024.0:
                return f"{size:.1f} {unit}"
            size /= 1024.0
        return f"{size:.1f} TB"
    except OSError:
        return "Unknown"

def create_thumbnail(image_path, size=(200, 200)):
    """Create thumbnail image"""
    try:
        img = Image.open(image_path)
        img.thumbnail(size, Image.Resampling.LANCZOS)
        
        # Save thumbnail
        thumb_path = image_path.replace('.', '_thumb.')
        img.save(thumb_path, 'JPEG', quality=85)
        
        return thumb_path
    except Exception as e:
        print(f"Error creating thumbnail: {e}")
        return None

def cleanup_old_files(directory, days_old=30):
    """Cleanup files older than specified days"""
    try:
        cutoff_date = datetime.now() - timedelta(days=days_old)
        
        for filename in os.listdir(directory):
            filepath = os.path.join(directory, filename)
            
            if os.path.isfile(filepath):
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))
                
                if file_time < cutoff_date:
                    os.remove(filepath)
                    print(f"Removed old file: {filename}")
    
    except Exception as e:
        print(f"Error cleaning up files: {e}")

class RateLimiter:
    """Simple rate limiter for API endpoints"""
    
    def __init__(self, max_requests=100, window=3600):
        self.max_requests = max_requests
        self.window = window
        self.requests = {}
    
    def is_allowed(self, ip_address):
        """Check if IP is allowed to make request"""
        now = datetime.now().timestamp()
        
        if ip_address not in self.requests:
            self.requests[ip_address] = []
        
        # Cleanup old requests
        self.requests[ip_address] = [
            req_time for req_time in self.requests[ip_address]
            if now - req_time < self.window
        ]
        
        if len(self.requests[ip_address]) < self.max_requests:
            self.requests[ip_address].append(now)
            return True
        
        return False
    
    def get_remaining(self, ip_address):
        """Get remaining requests for IP"""
        now = datetime.now().timestamp()
        
        if ip_address not in self.requests:
            return self.max_requests
        
        # Count requests in window
        recent_requests = [
            req_time for req_time in self.requests[ip_address]
            if now - req_time < self.window
        ]
        
        return max(0, self.max_requests - len(recent_requests))