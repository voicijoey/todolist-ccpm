/**
 * API Client for Epic Todo List
 * Handles all HTTP requests to the backend API
 */

class API {
    constructor() {
        this.baseURL = 'http://localhost:3001/api';
        this.token = localStorage.getItem('authToken');
    }

    /**
     * Set authentication token
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    /**
     * Get authentication token
     */
    getToken() {
        return this.token || localStorage.getItem('authToken');
    }

    /**
     * Clear authentication token
     */
    clearToken() {
        this.token = null;
        localStorage.removeItem('authToken');
    }

    /**
     * Make HTTP request with automatic token handling
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const token = this.getToken();

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        // Add authorization header if token exists
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        try {
            const response = await fetch(url, config);

            // Handle 401 - Unauthorized
            if (response.status === 401) {
                this.clearToken();
                window.location.reload();
                throw new Error('Session expired. Please login again.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }

    // ================================
    // Authentication Endpoints
    // ================================

    /**
     * Register new user
     */
    async register(userData) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
    }

    /**
     * Login user
     */
    async login(credentials) {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify(credentials)
        });

        if (response.token) {
            this.setToken(response.token);
        }

        return response;
    }

    /**
     * Logout user (clear local token)
     */
    logout() {
        this.clearToken();
    }

    /**
     * Get current user info
     */
    async getCurrentUser() {
        return this.request('/auth/me');
    }

    // ================================
    // Task Endpoints
    // ================================

    /**
     * Get all tasks
     */
    async getTasks(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/tasks?${queryString}` : '/tasks';
        return this.request(endpoint);
    }

    /**
     * Get single task by ID
     */
    async getTask(id) {
        return this.request(`/tasks/${id}`);
    }

    /**
     * Create new task
     */
    async createTask(taskData) {
        return this.request('/tasks', {
            method: 'POST',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Update existing task
     */
    async updateTask(id, taskData) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(taskData)
        });
    }

    /**
     * Delete task
     */
    async deleteTask(id) {
        return this.request(`/tasks/${id}`, {
            method: 'DELETE'
        });
    }

    /**
     * Toggle task completion status
     */
    async toggleTask(id, completed) {
        return this.request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ completed })
        });
    }

    // ================================
    // Health Check
    // ================================

    /**
     * Check API health
     */
    async healthCheck() {
        return this.request('/health');
    }
}

// Create global API instance
window.api = new API();