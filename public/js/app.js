/**
 * Main Application Controller for Epic Todo List
 * Coordinates all components and handles global app state
 */

class App {
    constructor() {
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.onDOMReady();
            });
        } else {
            this.onDOMReady();
        }
    }

    /**
     * DOM ready handler
     */
    onDOMReady() {
        console.log('Epic Todo List - Application starting...');

        // Initialize global components
        this.initializeToast();
        this.bindGlobalEvents();

        // Check API health
        this.checkAPIHealth();

        console.log('Epic Todo List - Application initialized');
    }

    /**
     * Initialize toast notification system
     */
    initializeToast() {
        window.toast = new ToastNotification();
    }

    /**
     * Bind global event listeners
     */
    bindGlobalEvents() {
        // Handle online/offline status
        window.addEventListener('online', () => {
            window.toast.show('Connection restored', 'success');
        });

        window.addEventListener('offline', () => {
            window.toast.show('Connection lost', 'warning');
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            window.toast.show('An unexpected error occurred', 'error');
        });

        // Handle global errors
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
        });
    }

    /**
     * Check API health on startup
     */
    async checkAPIHealth() {
        try {
            await window.api.healthCheck();
            console.log('API health check passed');
        } catch (error) {
            console.error('API health check failed:', error);
            window.toast.show('Server connection issues detected', 'warning');
        }
    }
}

/**
 * Toast Notification System
 */
class ToastNotification {
    constructor() {
        this.toastElement = document.getElementById('toast');
        this.messageElement = document.getElementById('toast-message');
        this.closeButton = document.getElementById('toast-close');
        this.currentTimeout = null;

        this.bindEvents();
    }

    /**
     * Bind toast events
     */
    bindEvents() {
        // Close button
        this.closeButton.addEventListener('click', () => {
            this.hide();
        });

        // Click anywhere on toast to close
        this.toastElement.addEventListener('click', () => {
            this.hide();
        });
    }

    /**
     * Show toast notification
     */
    show(message, type = 'info', duration = 4000) {
        // Clear existing timeout
        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
        }

        // Set message and type
        this.messageElement.textContent = message;

        // Remove existing type classes
        this.toastElement.classList.remove('success', 'error', 'warning', 'info');

        // Add new type class
        if (type) {
            this.toastElement.classList.add(type);
        }

        // Show toast
        this.toastElement.classList.remove('hidden');

        // Auto-hide after duration
        if (duration > 0) {
            this.currentTimeout = setTimeout(() => {
                this.hide();
            }, duration);
        }
    }

    /**
     * Hide toast notification
     */
    hide() {
        this.toastElement.classList.add('hidden');

        if (this.currentTimeout) {
            clearTimeout(this.currentTimeout);
            this.currentTimeout = null;
        }
    }

    /**
     * Show success toast
     */
    success(message, duration = 3000) {
        this.show(message, 'success', duration);
    }

    /**
     * Show error toast
     */
    error(message, duration = 5000) {
        this.show(message, 'error', duration);
    }

    /**
     * Show warning toast
     */
    warning(message, duration = 4000) {
        this.show(message, 'warning', duration);
    }

    /**
     * Show info toast
     */
    info(message, duration = 4000) {
        this.show(message, 'info', duration);
    }
}

/**
 * Utility Functions
 */
const Utils = {
    /**
     * Format date for display
     */
    formatDate(dateString, options = {}) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            ...options
        };

        return date.toLocaleDateString(undefined, defaultOptions);
    },

    /**
     * Format date and time for display
     */
    formatDateTime(dateString, options = {}) {
        if (!dateString) return '';

        const date = new Date(dateString);
        const defaultOptions = {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            ...options
        };

        return date.toLocaleString(undefined, defaultOptions);
    },

    /**
     * Check if date is overdue
     */
    isOverdue(dateString) {
        if (!dateString) return false;
        return new Date(dateString) < new Date();
    },

    /**
     * Check if date is due soon (within 24 hours)
     */
    isDueSoon(dateString) {
        if (!dateString) return false;
        const dueDate = new Date(dateString);
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        return dueDate > now && dueDate <= tomorrow;
    },

    /**
     * Debounce function calls
     */
    debounce(func, wait) {
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

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Sanitize HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Generate random ID
     */
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    },

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                return true;
            }
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }
};

// Make utilities globally available
window.Utils = Utils;

// Initialize the application
const app = new App();

// Initialize app based on authentication status
document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("authToken");
    const authContainer = document.getElementById("auth-container");
    const appContainer = document.getElementById("app-container");

    if (token) {
        // User is authenticated, show app
        authContainer.classList.add("hidden");
        appContainer.classList.remove("hidden");
    } else {
        // User not authenticated, show login form
        authContainer.classList.remove("hidden");
        appContainer.classList.add("hidden");
    }
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App, ToastNotification, Utils };
}