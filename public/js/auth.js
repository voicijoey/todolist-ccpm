/**
 * Authentication Component for Epic Todo List
 * Handles user registration, login, logout, and session management
 */

class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    /**
     * Initialize authentication system
     */
    async init() {
        // Check if user is already logged in
        const token = window.api.getToken();
        if (token) {
            try {
                console.log('Validating existing session...');
                const response = await window.api.getCurrentUser();

                // Handle the response format from backend
                const userData = response.data ? response.data.user : response.user;
                if (userData) {
                    this.setCurrentUser(userData);
                    this.showApp();
                    console.log('Session validated successfully:', userData.email);
                } else {
                    throw new Error('Invalid user data received');
                }
            } catch (error) {
                console.error('Failed to validate existing session:', error);
                // Clear invalid token and show login
                window.api.clearToken();
                this.showAuth();
            }
        } else {
            console.log('No existing token found, showing login');
            this.showAuth();
        }

        this.bindEvents();
    }

    /**
     * Bind authentication event listeners
     */
    bindEvents() {
        // Show register form
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        // Show login form
        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Login form submission
        document.getElementById('login').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin(e);
        });

        // Register form submission
        document.getElementById('register').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister(e);
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    /**
     * Show login form
     */
    showLoginForm() {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        this.clearFormErrors();
    }

    /**
     * Show register form
     */
    showRegisterForm() {
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
        this.clearFormErrors();
    }

    /**
     * Show authentication container
     */
    showAuth() {
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
    }

    /**
     * Show main application
     */
    showApp() {
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');

        // Update user info display
        if (this.currentUser) {
            const displayName = this.currentUser.first_name || this.currentUser.email || 'User';
            document.getElementById('user-info').textContent =
                `Welcome, ${displayName}`;
        }
    }

    /**
     * Handle login form submission
     */
    async handleLogin(event) {
        const formData = new FormData(event.target);
        const credentials = {
            email: formData.get('email') || document.getElementById('login-email').value,
            password: formData.get('password') || document.getElementById('login-password').value
        };

        // Clear previous errors
        this.clearFormErrors();

        // Basic validation
        if (!credentials.email || !credentials.password) {
            this.showFormError('login-email', 'Please fill in all fields');
            return;
        }

        try {
            const response = await window.api.login(credentials);
            this.setCurrentUser(response.user);
            this.showApp();
            window.toast.show('Login successful!', 'success');

            // Load tasks after successful login
            if (window.taskManager) {
                await window.taskManager.loadTasks();
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showFormError('login-email', error.message);
        }
    }

    /**
     * Handle register form submission
     */
    async handleRegister(event) {
        const formData = new FormData(event.target);
        const userData = {
            firstName: formData.get('firstName') || document.getElementById('register-username').value,
            lastName: formData.get('lastName') || '',
            email: formData.get('email') || document.getElementById('register-email').value,
            password: formData.get('password') || document.getElementById('register-password').value
        };

        // Clear previous errors
        this.clearFormErrors();

        // Basic validation
        if (!userData.firstName || !userData.email || !userData.password) {
            this.showFormError('register-username', 'Please fill in all fields');
            return;
        }

        if (userData.password.length < 8) {
            this.showFormError('register-password', 'Password must be at least 8 characters');
            return;
        }

        if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(userData.password)) {
            this.showFormError('register-password', 'Password must contain uppercase, lowercase and number');
            return;
        }

        try {
            await window.api.register(userData);
            window.toast.show('Registration successful! Please login.', 'success');
            this.showLoginForm();

            // Pre-fill login form with email
            document.getElementById('login-email').value = userData.email;
        } catch (error) {
            console.error('Registration error:', error);
            this.showFormError('register-email', error.message);
        }
    }

    /**
     * Handle logout
     */
    handleLogout() {
        window.api.logout();
        this.setCurrentUser(null);
        this.showAuth();
        window.toast.show('Logged out successfully', 'success');

        // Clear any cached data
        if (window.taskManager) {
            window.taskManager.clearTasks();
        }
    }

    /**
     * Set current user
     */
    setCurrentUser(user) {
        this.currentUser = user;
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return !!this.currentUser && !!window.api.getToken();
    }

    /**
     * Show form error message
     */
    showFormError(fieldId, message) {
        const errorElement = document.getElementById(`${fieldId}-error`);
        if (errorElement) {
            errorElement.textContent = message;
        }
    }

    /**
     * Clear all form error messages
     */
    clearFormErrors() {
        const errorElements = document.querySelectorAll('.error-message');
        errorElements.forEach(element => {
            element.textContent = '';
        });
    }

    /**
     * Clear form data
     */
    clearForms() {
        document.getElementById('login').reset();
        document.getElementById('register').reset();
        this.clearFormErrors();
    }
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});