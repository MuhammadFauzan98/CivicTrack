// Main JavaScript file for Smart City Dashboard

document.addEventListener('DOMContentLoaded', function() {
    // Close alert buttons
    const closeAlertButtons = document.querySelectorAll('.close-alert');
    closeAlertButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.parentElement.style.display = 'none';
        });
    });
    
    // Mobile menu toggle
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            
            if (window.innerWidth <= 992) {
                if (navLinks.style.display === 'flex') {
                    navLinks.style.flexDirection = 'column';
                    navLinks.style.position = 'absolute';
                    navLinks.style.top = '100%';
                    navLinks.style.left = '0';
                    navLinks.style.right = '0';
                    navLinks.style.backgroundColor = 'white';
                    navLinks.style.padding = '20px';
                    navLinks.style.boxShadow = '0 10px 20px rgba(0,0,0,0.1)';
                    navLinks.style.zIndex = '1000';
                }
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', function() {
            if (window.innerWidth > 992) {
                navLinks.style.display = 'flex';
                navLinks.style.flexDirection = 'row';
                navLinks.style.position = 'static';
                navLinks.style.padding = '0';
                navLinks.style.boxShadow = 'none';
            } else {
                navLinks.style.display = 'none';
            }
        });
    }
    
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(element => {
        element.addEventListener('mouseenter', function() {
            const tooltipText = this.getAttribute('data-tooltip');
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = tooltipText;
            document.body.appendChild(tooltip);
            
            const rect = this.getBoundingClientRect();
            tooltip.style.position = 'absolute';
            tooltip.style.left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2 + 'px';
            tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';
            tooltip.style.backgroundColor = 'var(--primary)';
            tooltip.style.color = 'white';
            tooltip.style.padding = '5px 10px';
            tooltip.style.borderRadius = '4px';
            tooltip.style.fontSize = '12px';
            tooltip.style.zIndex = '10000';
            
            this.tooltipElement = tooltip;
        });
        
        element.addEventListener('mouseleave', function() {
            if (this.tooltipElement) {
                this.tooltipElement.remove();
                this.tooltipElement = null;
            }
        });
    });
    
    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.5s';
            setTimeout(() => {
                if (alert.parentNode) {
                    alert.style.display = 'none';
                }
            }, 500);
        }, 5000);
    });
    
    // Form validation
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const requiredFields = this.querySelectorAll('[required]');
            let valid = true;
            
            requiredFields.forEach(field => {
                if (!field.value.trim()) {
                    valid = false;
                    field.style.borderColor = 'var(--danger)';
                    
                    // Add error message if not already present
                    if (!field.nextElementSibling || !field.nextElementSibling.classList.contains('field-error')) {
                        const error = document.createElement('div');
                        error.className = 'field-error';
                        error.textContent = 'This field is required';
                        error.style.color = 'var(--danger)';
                        error.style.fontSize = '14px';
                        error.style.marginTop = '5px';
                        field.parentNode.insertBefore(error, field.nextSibling);
                    }
                } else {
                    field.style.borderColor = '#ddd';
                    const error = field.nextElementSibling;
                    if (error && error.classList.contains('field-error')) {
                        error.remove();
                    }
                }
            });
            
            if (!valid) {
                e.preventDefault();
                e.stopPropagation();
            }
        });
    });
    
    // Status color coding
    const statusElements = document.querySelectorAll('.status-text');
    statusElements.forEach(element => {
        const status = element.textContent.toLowerCase().trim();
        element.classList.remove('status-pending', 'status-in-progress', 'status-resolved');
        
        if (status.includes('pending')) {
            element.classList.add('status-pending');
        } else if (status.includes('progress')) {
            element.classList.add('status-in-progress');
        } else if (status.includes('resolved')) {
            element.classList.add('status-resolved');
        }
    });
});

// Utility function for making API requests
async function fetchData(url, options = {}) {
    try {
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching data:', error);
        showNotification('Error loading data. Please try again.', 'danger');
        return null;
    }
}

// Show notification
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.padding = '15px 20px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    notification.style.zIndex = '10000';
    notification.style.color = 'white';
    notification.style.fontWeight = '500';
    notification.style.maxWidth = '300px';
    
    // Set background color based on type
    if (type === 'success') {
        notification.style.backgroundColor = 'var(--success)';
    } else if (type === 'danger') {
        notification.style.backgroundColor = 'var(--danger)';
    } else if (type === 'warning') {
        notification.style.backgroundColor = 'var(--warning)';
    } else {
        notification.style.backgroundColor = 'var(--secondary)';
    }
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.color = 'white';
    closeBtn.style.fontSize = '20px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.marginLeft = '15px';
    closeBtn.style.float = 'right';
    
    closeBtn.addEventListener('click', () => {
        notification.remove();
    });
    
    notification.appendChild(closeBtn);
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}