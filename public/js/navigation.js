/**
 * Navigation Manager for Epic Todo List
 * Handles switching between different views (tasks and analytics)
 */

class NavigationManager {
    constructor() {
        this.currentView = 'tasks';
        this.currentTaskFilter = 'all';
        this.init();
    }

    /**
     * Initialize navigation manager
     */
    init() {
        this.bindEvents();
        this.initializeView();
    }

    /**
     * Bind navigation event listeners
     */
    bindEvents() {
        // Handle all navigation buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.getAttribute('data-view');
                const filterId = e.target.id;

                if (view === 'analytics') {
                    this.switchToAnalytics();
                } else if (view === 'tasks') {
                    // Handle task filter buttons
                    if (filterId === 'view-all-btn') {
                        this.switchToTasks('all');
                    } else if (filterId === 'view-pending-btn') {
                        this.switchToTasks('pending');
                    } else if (filterId === 'view-completed-btn') {
                        this.switchToTasks('completed');
                    }
                }
            });
        });
    }

    /**
     * Initialize the view based on URL or default
     */
    initializeView() {
        // Check URL hash for initial view
        const hash = window.location.hash.slice(1);
        if (hash === 'analytics') {
            this.switchToAnalytics();
        } else {
            this.switchToTasks('all');
        }
    }

    /**
     * Switch to tasks view with specified filter
     */
    async switchToTasks(filter = 'all') {
        try {
            this.currentView = 'tasks';
            this.currentTaskFilter = filter;

            // Update URL
            window.location.hash = '';

            // Show/hide containers
            this.showTasksContainer();
            this.hideAnalyticsContainer();

            // Update navigation buttons
            this.updateNavButtons(filter);

            // Update search/filter bar visibility
            this.showSearchFilter();

            // Wait for task manager to be initialized by tasks.js
            if (!window.taskManager) {
                // Task manager will be initialized by tasks.js DOMContentLoaded event
                // Wait for it to be available
                return new Promise((resolve) => {
                    const checkTaskManager = () => {
                        if (window.taskManager) {
                            window.taskManager.setFilter(filter);
                            window.taskManager.loadTasks().then(resolve);
                        } else {
                            setTimeout(checkTaskManager, 10);
                        }
                    };
                    checkTaskManager();
                });
            } else {
                // Load tasks with filter
                await window.taskManager.setFilter(filter);
                await window.taskManager.loadTasks();
            }

        } catch (error) {
            console.error('Error switching to tasks view:', error);
            window.toast.error('Failed to load tasks view');
        }
    }

    /**
     * Switch to analytics view
     */
    async switchToAnalytics() {
        try {
            this.currentView = 'analytics';

            // Update URL
            window.location.hash = 'analytics';

            // Show/hide containers
            this.hideTasksContainer();
            this.showAnalyticsContainer();

            // Update navigation buttons
            this.updateNavButtons('analytics');

            // Hide search/filter bar (not needed for analytics)
            this.hideSearchFilter();

            // Initialize analytics manager if not already done
            if (!window.analyticsManager.isInitialized) {
                await window.analyticsManager.init();
            }

            // Load analytics dashboard
            await window.analyticsManager.loadDashboard();

        } catch (error) {
            console.error('Error switching to analytics view:', error);
            window.toast.error('Failed to load analytics dashboard');
        }
    }

    /**
     * Update navigation button states
     */
    updateNavButtons(activeId) {
        // Remove active class from all nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Add active class to appropriate button
        let activeButton;
        if (activeId === 'analytics') {
            activeButton = document.getElementById('view-analytics-btn');
        } else {
            activeButton = document.getElementById(`view-${activeId}-btn`);
        }

        if (activeButton) {
            activeButton.classList.add('active');
        }
    }

    /**
     * Show tasks container
     */
    showTasksContainer() {
        const container = document.getElementById('task-container');
        if (container) {
            container.classList.remove('hidden');
        }
    }

    /**
     * Hide tasks container
     */
    hideTasksContainer() {
        const container = document.getElementById('task-container');
        if (container) {
            container.classList.add('hidden');
        }
    }

    /**
     * Show analytics container
     */
    showAnalyticsContainer() {
        const container = document.getElementById('analytics-container');
        if (container) {
            container.classList.remove('hidden');
        }
    }

    /**
     * Hide analytics container
     */
    hideAnalyticsContainer() {
        const container = document.getElementById('analytics-container');
        if (container) {
            container.classList.add('hidden');
        }
    }

    /**
     * Show search and filter bar
     */
    showSearchFilter() {
        const searchFilter = document.querySelector('.search-filter-bar');
        if (searchFilter) {
            searchFilter.style.display = 'block';
        }
    }

    /**
     * Hide search and filter bar
     */
    hideSearchFilter() {
        const searchFilter = document.querySelector('.search-filter-bar');
        if (searchFilter) {
            searchFilter.style.display = 'none';
        }
    }

    /**
     * Get current view
     */
    getCurrentView() {
        return this.currentView;
    }

    /**
     * Get current task filter
     */
    getCurrentTaskFilter() {
        return this.currentTaskFilter;
    }

    /**
     * Handle browser back/forward navigation
     */
    handlePopState() {
        this.initializeView();
    }
}

// Handle browser navigation
window.addEventListener('popstate', () => {
    if (window.navigationManager) {
        window.navigationManager.handlePopState();
    }
});

// Global navigation manager instance
window.navigationManager = new NavigationManager();