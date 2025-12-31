// Utility functions for enhanced interactivity

class UIAnimator {
    constructor() {
        this.observers = new Map();
        this.init();
    }
    
    init() {
        this.setupIntersectionObserver();
        this.setupScrollAnimations();
        this.setupHoverEffects();
        this.setupParallax();
        this.setupParticles();
    }
    
    setupIntersectionObserver() {
        const observerOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.1
        };
        
        this.intersectionObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                    
                    // Dispatch custom event
                    const event = new CustomEvent('elementVisible', {
                        detail: { element: entry.target }
                    });
                    document.dispatchEvent(event);
                }
            });
        }, observerOptions);
        
        // Observe all elements with data-animate attribute
        document.querySelectorAll('[data-animate]').forEach(el => {
            this.intersectionObserver.observe(el);
        });
    }
    
    setupScrollAnimations() {
        let ticking = false;
        
        const onScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.handleScrollAnimations();
                    ticking = false;
                });
                ticking = true;
            }
        };
        
        window.addEventListener('scroll', onScroll, { passive: true });
    }
    
    handleScrollAnimations() {
        const scrollY = window.scrollY;
        const viewportHeight = window.innerHeight;
        
        // Parallax elements
        document.querySelectorAll('[data-parallax]').forEach(el => {
            const speed = parseFloat(el.getAttribute('data-parallax')) || 0.5;
            const yPos = -(scrollY * speed);
            el.style.transform = `translateY(${yPos}px)`;
        });
        
        // Progress bars based on scroll
        document.querySelectorAll('[data-scroll-progress]').forEach(el => {
            const rect = el.getBoundingClientRect();
            const progress = Math.max(0, Math.min(1, 
                (viewportHeight - rect.top) / (viewportHeight + rect.height)
            ));
            
            el.style.setProperty('--scroll-progress', progress);
        });
    }
    
    setupHoverEffects() {
        // Magnetic buttons
        document.querySelectorAll('.magnetic-btn').forEach(btn => {
            btn.addEventListener('mousemove', (e) => {
                const rect = btn.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                btn.style.setProperty('--x', `${x}px`);
                btn.style.setProperty('--y', `${y}px`);
            });
        });
        
        // Tilt effect
        document.querySelectorAll('[data-tilt]').forEach(el => {
            el.addEventListener('mousemove', (e) => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / 10;
                const rotateY = (centerX - x) / 10;
                
                el.style.transform = `
                    perspective(1000px)
                    rotateX(${rotateX}deg)
                    rotateY(${rotateY}deg)
                `;
            });
            
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'perspective(1000px) rotateX(0) rotateY(0)';
            });
        });
    }
    
    setupParallax() {
        // Already handled in scroll animations
    }
    
    setupParticles() {
        const containers = document.querySelectorAll('.particle-container');
        
        containers.forEach(container => {
            const particleCount = parseInt(container.getAttribute('data-particle-count')) || 20;
            
            for (let i = 0; i < particleCount; i++) {
                this.createParticle(container);
            }
        });
    }
    
    createParticle(container) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        
        // Random properties
        const size = Math.random() * 10 + 5;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const duration = Math.random() * 10 + 10;
        const delay = Math.random() * 5;
        
        particle.style.cssText = `
            width: ${size}px;
            height: ${size}px;
            left: ${x}%;
            top: ${y}%;
            opacity: ${Math.random() * 0.5 + 0.2};
            animation: float-particle ${duration}s ease-in-out ${delay}s infinite;
        `;
        
        container.appendChild(particle);
        
        // Add CSS for particle animation
        if (!document.querySelector('#particle-animations')) {
            const style = document.createElement('style');
            style.id = 'particle-animations';
            style.textContent = `
                @keyframes float-particle {
                    0%, 100% {
                        transform: translate(0, 0) rotate(0deg);
                    }
                    25% {
                        transform: translate(${Math.random() * 50 - 25}px, ${Math.random() * 50 - 25}px) rotate(90deg);
                    }
                    50% {
                        transform: translate(${Math.random() * 50 - 25}px, ${Math.random() * 50 - 25}px) rotate(180deg);
                    }
                    75% {
                        transform: translate(${Math.random() * 50 - 25}px, ${Math.random() * 50 - 25}px) rotate(270deg);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    // Public methods
    animateElement(element, animationName, duration = 1000) {
        element.style.animation = `${animationName} ${duration}ms ease-out`;
        
        return new Promise(resolve => {
            setTimeout(() => {
                element.style.animation = '';
                resolve();
            }, duration);
        });
    }
    
    createRipple(event) {
        const button = event.currentTarget;
        const circle = document.createElement('span');
        const diameter = Math.max(button.clientWidth, button.clientHeight);
        const radius = diameter / 2;
        
        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${event.clientX - button.getBoundingClientRect().left - radius}px`;
        circle.style.top = `${event.clientY - button.getBoundingClientRect().top - radius}px`;
        circle.classList.add('ripple');
        
        const ripple = button.getElementsByClassName('ripple')[0];
        if (ripple) {
            ripple.remove();
        }
        
        button.appendChild(circle);
    }
    
    createConfetti(options = {}) {
        const defaults = {
            count: 100,
            colors: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'],
            spread: 100,
            duration: 3000,
            size: [5, 15]
        };
        
        const config = { ...defaults, ...options };
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        `;
        
        document.body.appendChild(container);
        
        for (let i = 0; i < config.count; i++) {
            const confetti = document.createElement('div');
            confetti.classList.add('confetti', 'confetti-animation');
            
            const color = config.colors[Math.floor(Math.random() * config.colors.length)];
            const size = Math.random() * (config.size[1] - config.size[0]) + config.size[0];
            const left = Math.random() * 100;
            const rotation = Math.random() * 360;
            
            confetti.style.cssText = `
                background: ${color};
                width: ${size}px;
                height: ${size}px;
                left: ${left}%;
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation-duration: ${config.duration}ms;
                animation-delay: ${Math.random() * 1000}ms;
            `;
            
            container.appendChild(confetti);
        }
        
        // Cleanup after animation
        setTimeout(() => {
            container.remove();
        }, config.duration + 1000);
    }
    
    toggleDarkMode() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark);
        
        // Dispatch event
        const event = new CustomEvent('darkModeChange', {
            detail: { isDark }
        });
        document.dispatchEvent(event);
        
        return isDark;
    }
    
    // Observer pattern for reactive animations
    observe(element, callback) {
        if (!this.observers.has(element)) {
            this.observers.set(element, []);
        }
        this.observers.get(element).push(callback);
    }
    
    notify(element, data) {
        const callbacks = this.observers.get(element);
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }
}

// Initialize UI Animator
document.addEventListener('DOMContentLoaded', () => {
    window.uiAnimator = new UIAnimator();
    
    // Add ripple effect to buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            uiAnimator.createRipple(e);
        });
    });
    
    // Check for saved dark mode preference
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
    }
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+D to toggle dark mode
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            uiAnimator.toggleDarkMode();
        }
        
        // Ctrl+Shift+C for confetti
        if (e.ctrlKey && e.shiftKey && e.key === 'C') {
            e.preventDefault();
            uiAnimator.createConfetti();
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const modals = document.querySelectorAll('.modal.show');
            modals.forEach(modal => {
                modal.classList.remove('show');
            });
        }
    });
});

// Additional utility functions
const Utils = {
    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    // Throttle function
    throttle: (func, limit) => {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Format numbers
    formatNumber: (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    },
    
    // Format date
    formatDate: (date, format = 'relative') => {
        const d = new Date(date);
        
        if (format === 'relative') {
            const now = new Date();
            const diff = now - d;
            
            const minute = 60 * 1000;
            const hour = minute * 60;
            const day = hour * 24;
            const week = day * 7;
            
            if (diff < minute) return 'Just now';
            if (diff < hour) return Math.floor(diff / minute) + ' minutes ago';
            if (diff < day) return Math.floor(diff / hour) + ' hours ago';
            if (diff < week) return Math.floor(diff / day) + ' days ago';
            
            return d.toLocaleDateString();
        }
        
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Generate random ID
    generateId: (length = 8) => {
        return Math.random().toString(36).substr(2, length);
    },
    
    // Copy to clipboard
    copyToClipboard: (text) => {
        return navigator.clipboard.writeText(text);
    },
    
    // Download file
    downloadFile: (content, filename, type = 'text/plain') => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    // Validate email
    validateEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },
    
    // Validate URL
    validateURL: (url) => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    },
    
    // Deep clone object
    deepClone: (obj) => {
        return JSON.parse(JSON.stringify(obj));
    },
    
    // Merge objects
    mergeObjects: (...objects) => {
        return objects.reduce((acc, obj) => {
            Object.keys(obj).forEach(key => {
                if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
                    acc[key] = Utils.mergeObjects(acc[key] || {}, obj[key]);
                } else {
                    acc[key] = obj[key];
                }
            });
            return acc;
        }, {});
    },
    
    // Get query parameters
    getQueryParams: () => {
        return Object.fromEntries(new URLSearchParams(window.location.search));
    },
    
    // Set query parameters
    setQueryParams: (params) => {
        const url = new URL(window.location);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.set(key, value);
        });
        window.history.pushState({}, '', url);
    },
    
    // Smooth scroll to element
    smoothScrollTo: (element, offset = 0) => {
        const target = typeof element === 'string' 
            ? document.querySelector(element)
            : element;
        
        if (target) {
            const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
            const startPosition = window.pageYOffset;
            const distance = targetPosition - startPosition - offset;
            const duration = 1000;
            let start = null;
            
            const animation = (currentTime) => {
                if (start === null) start = currentTime;
                const timeElapsed = currentTime - start;
                const run = ease(timeElapsed, startPosition, distance, duration);
                window.scrollTo(0, run);
                if (timeElapsed < duration) requestAnimationFrame(animation);
            };
            
            const ease = (t, b, c, d) => {
                t /= d / 2;
                if (t < 1) return c / 2 * t * t + b;
                t--;
                return -c / 2 * (t * (t - 2) - 1) + b;
            };
            
            requestAnimationFrame(animation);
        }
    },
    
    // Create modal
    createModal: (options) => {
        const defaults = {
            title: 'Modal',
            content: '',
            size: 'md', // sm, md, lg, xl
            showClose: true,
            backdrop: true,
            onClose: () => {}
        };
        
        const config = { ...defaults, ...options };
        
        // Create modal element
        const modal = document.createElement('div');
        modal.classList.add('modal', 'fade');
        modal.innerHTML = `
            <div class="modal-dialog modal-${config.size}">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">${config.title}</h5>
                        ${config.showClose ? 
                            '<button type="button" class="btn-close" data-bs-dismiss="modal"></button>' : ''}
                    </div>
                    <div class="modal-body">
                        ${config.content}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to document
        document.body.appendChild(modal);
        
        // Show modal
        setTimeout(() => {
            modal.classList.add('show');
            modal.style.display = 'block';
            document.body.classList.add('modal-open');
            
            if (config.backdrop) {
                const backdrop = document.createElement('div');
                backdrop.classList.add('modal-backdrop', 'fade', 'show');
                document.body.appendChild(backdrop);
            }
        }, 10);
        
        // Close handlers
        const closeModal = () => {
            modal.classList.remove('show');
            setTimeout(() => {
                modal.remove();
                document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                document.body.classList.remove('modal-open');
                config.onClose();
            }, 300);
        };
        
        modal.querySelectorAll('[data-bs-dismiss="modal"]').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
        
        if (config.backdrop) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }
        
        return {
            close: closeModal,
            element: modal
        };
    },
    
    // Create toast notification
    createToast: (options) => {
        const defaults = {
            title: 'Notification',
            message: '',
            type: 'info', // success, error, warning, info
            duration: 5000,
            position: 'top-right' // top-right, top-left, bottom-right, bottom-left
        };
        
        const config = { ...defaults, ...options };
        
        // Create toast container if not exists
        let container = document.querySelector(`.toast-container.${config.position}`);
        if (!container) {
            container = document.createElement('div');
            container.classList.add('toast-container', config.position);
            container.style.cssText = `
                position: fixed;
                z-index: 9999;
                ${config.position.includes('top') ? 'top: 20px;' : 'bottom: 20px;'}
                ${config.position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
                max-width: 350px;
            `;
            document.body.appendChild(container);
        }
        
        // Create toast
        const toast = document.createElement('div');
        toast.classList.add('toast', 'show');
        toast.innerHTML = `
            <div class="toast-header">
                <strong class="me-auto">${config.title}</strong>
                <small>${new Date().toLocaleTimeString()}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                ${config.message}
            </div>
        `;
        
        // Add type styling
        const typeIcons = {
            success: 'fas fa-check-circle text-success',
            error: 'fas fa-exclamation-circle text-danger',
            warning: 'fas fa-exclamation-triangle text-warning',
            info: 'fas fa-info-circle text-info'
        };
        
        if (typeIcons[config.type]) {
            const icon = document.createElement('i');
            icon.className = typeIcons[config.type];
            toast.querySelector('.toast-header strong').prepend(icon);
            icon.style.marginRight = '8px';
        }
        
        container.appendChild(toast);
        
        // Auto remove
        if (config.duration > 0) {
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 300);
            }, config.duration);
        }
        
        // Close button
        toast.querySelector('.btn-close').addEventListener('click', () => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        });
        
        return toast;
    }
};

// Make Utils available globally
window.Utils = Utils;

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UIAnimator, Utils };
}