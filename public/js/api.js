/**
 * API Client for Epic Todo List
 * Handles all HTTP requests to the backend API
 */

class API {
    constructor() {
        this.baseURL = 'http://localhost:3000/api';
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
                // Show login form instead of redirecting
                const authContainer = document.getElementById("auth-container");
                const appContainer = document.getElementById("app-container");
                if (authContainer && appContainer) {
                    authContainer.classList.remove("hidden");
                    appContainer.classList.add("hidden");
                }
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

    /**
     * Perform bulk operations on tasks
     */
    async bulkOperations(operation, taskIds, updates = null) {
        return this.request('/tasks/bulk', {
            method: 'POST',
            body: JSON.stringify({
                operation,
                taskIds,
                updates
            })
        });
    }

    /**
     * Get task statistics
     */
    async getTaskStats(filters = {}) {
        const queryString = new URLSearchParams(filters).toString();
        const endpoint = queryString ? `/tasks/stats?${queryString}` : '/tasks/stats';
        return this.request(endpoint);
    }

    /**
     * Get search suggestions
     */
    async getSearchSuggestions(query) {
        const params = new URLSearchParams({ q: query }).toString();
        return this.request(`/tasks/search/suggestions?${params}`);
    }

    /**
     * Get search history
     */
    async getSearchHistory(limit = 10) {
        const params = new URLSearchParams({ limit: limit.toString() }).toString();
        return this.request(`/tasks/search/history?${params}`);
    }

    /**
     * Clear search history
     */
    async clearSearchHistory() {
        return this.request('/tasks/search/history', {
            method: 'DELETE'
        });
    }

    // ================================
    // Analytics
    // ================================

    /**
     * Get analytics dashboard data
     */
    async getAnalyticsDashboard(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/dashboard?${queryString}` : '/analytics/dashboard';
        return this.request(endpoint);
    }

    /**
     * Get analytics overview
     */
    async getAnalyticsOverview(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/overview?${queryString}` : '/analytics/overview';
        return this.request(endpoint);
    }

    /**
     * Get completion trends
     */
    async getCompletionTrends(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/completion-trends?${queryString}` : '/analytics/completion-trends';
        return this.request(endpoint);
    }

    /**
     * Get category breakdown
     */
    async getCategoryBreakdown(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/category-breakdown?${queryString}` : '/analytics/category-breakdown';
        return this.request(endpoint);
    }

    /**
     * Get priority analysis
     */
    async getPriorityAnalysis(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/priority-analysis?${queryString}` : '/analytics/priority-analysis';
        return this.request(endpoint);
    }

    /**
     * Get productivity metrics
     */
    async getProductivityMetrics(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/productivity?${queryString}` : '/analytics/productivity';
        return this.request(endpoint);
    }

    /**
     * Get goal tracking
     */
    async getGoalTracking(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString ? `/analytics/goals?${queryString}` : '/analytics/goals';
        return this.request(endpoint);
    }

    /**
     * Export to CSV
     */
    async exportCSV(data) {
        return this.request('/analytics/export/csv', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Export to PDF
     */
    async exportPDF(data) {
        return this.request('/analytics/export/pdf', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Get export history
     */
    async getExportHistory() {
        return this.request('/analytics/exports');
    }

    /**
     * Clean up old exports
     */
    async cleanupExports(data = {}) {
        return this.request('/analytics/exports/cleanup', {
            method: 'DELETE',
            body: JSON.stringify(data)
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