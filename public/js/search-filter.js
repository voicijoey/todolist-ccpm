/**
 * Search and Filter Component for Epic Todo List
 * Handles search functionality, advanced filtering, and UI interactions
 */

class SearchFilterManager {
    constructor(taskManager) {
        this.taskManager = taskManager;
        this.searchTimeout = null;
        this.currentFilters = {};
        this.currentSort = { field: 'created_at', order: 'desc' };
        this.currentSearchTerm = '';
        this.isFilterPanelOpen = false;
        this.init();
    }

    /**
     * Initialize search and filter manager
     */
    init() {
        this.bindEvents();
        this.loadSavedFilters();
    }

    /**
     * Bind search and filter event listeners
     */
    bindEvents() {
        // Search input events
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear-btn');

        searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch(e.target.value);
            }
        });

        searchClear.addEventListener('click', () => {
            this.clearSearch();
        });

        // Filter toggle
        const filterToggle = document.getElementById('filter-toggle-btn');
        filterToggle.addEventListener('click', () => {
            this.toggleFilterPanel();
        });

        // Filter actions
        const applyFilters = document.getElementById('apply-filters-btn');
        const clearFilters = document.getElementById('clear-filters-btn');

        applyFilters.addEventListener('click', () => {
            this.applyFilters();
        });

        clearFilters.addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Sort selection
        const sortSelect = document.getElementById('sort-select');
        sortSelect.addEventListener('change', (e) => {
            this.handleSortChange(e.target.value);
        });

        // Close filter panel when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.filter-container') && this.isFilterPanelOpen) {
                this.closeFilterPanel();
            }
        });

        // Hide suggestions when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.search-container')) {
                this.hideSuggestions();
            }
        });
    }

    /**
     * Handle search input with debouncing
     */
    handleSearchInput(value) {
        this.currentSearchTerm = value;

        // Show/hide clear button
        const clearBtn = document.getElementById('search-clear-btn');
        if (value.trim()) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }

        // Clear previous timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Show suggestions for queries >= 2 characters
        if (value.trim().length >= 2) {
            this.searchTimeout = setTimeout(() => {
                this.showSearchSuggestions(value.trim());
            }, 300);
        } else {
            this.hideSuggestions();
        }

        // Perform search with debouncing
        this.searchTimeout = setTimeout(() => {
            this.performSearch(value);
        }, 500);
    }

    /**
     * Show search suggestions
     */
    async showSearchSuggestions(query) {
        try {
            const response = await window.api.getSearchSuggestions(query);
            const suggestions = response.data.suggestions || [];

            if (suggestions.length > 0) {
                this.renderSuggestions(suggestions);
            } else {
                this.hideSuggestions();
            }
        } catch (error) {
            console.error('Failed to load suggestions:', error);
            this.hideSuggestions();
        }
    }

    /**
     * Render search suggestions
     */
    renderSuggestions(suggestions) {
        const container = document.getElementById('search-suggestions');

        const html = suggestions.map(suggestion => `
            <div class="suggestion-item" data-text="${this.escapeHtml(suggestion.text)}">
                <span class="suggestion-icon">${suggestion.type === 'history' ? '🕒' : '📋'}</span>
                <span>${this.escapeHtml(suggestion.text)}</span>
            </div>
        `).join('');

        container.innerHTML = html;
        container.classList.remove('hidden');

        // Bind click events to suggestions
        container.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', () => {
                const text = item.dataset.text;
                document.getElementById('search-input').value = text;
                this.performSearch(text);
                this.hideSuggestions();
            });
        });
    }

    /**
     * Hide search suggestions
     */
    hideSuggestions() {
        document.getElementById('search-suggestions').classList.add('hidden');
    }

    /**
     * Clear search
     */
    clearSearch() {
        document.getElementById('search-input').value = '';
        document.getElementById('search-clear-btn').classList.add('hidden');
        this.currentSearchTerm = '';
        this.hideSuggestions();
        this.taskManager.loadTasks();
    }

    /**
     * Perform search
     */
    performSearch(query) {
        this.currentSearchTerm = query;
        this.hideSuggestions();
        this.taskManager.loadTasks();
    }

    /**
     * Toggle filter panel
     */
    toggleFilterPanel() {
        const panel = document.getElementById('filter-panel');
        const toggle = document.getElementById('filter-toggle-btn');

        if (this.isFilterPanelOpen) {
            this.closeFilterPanel();
        } else {
            panel.classList.remove('hidden');
            toggle.classList.add('active');
            this.isFilterPanelOpen = true;
        }
    }

    /**
     * Close filter panel
     */
    closeFilterPanel() {
        const panel = document.getElementById('filter-panel');
        const toggle = document.getElementById('filter-toggle-btn');

        panel.classList.add('hidden');
        toggle.classList.remove('active');
        this.isFilterPanelOpen = false;
    }

    /**
     * Apply filters
     */
    applyFilters() {
        const priority = document.getElementById('priority-filter').value;
        const category = document.getElementById('category-filter').value;
        const status = document.getElementById('status-filter').value;
        const dueAfter = document.getElementById('due-after-filter').value;
        const dueBefore = document.getElementById('due-before-filter').value;
        const createdAfter = document.getElementById('created-after-filter').value;
        const createdBefore = document.getElementById('created-before-filter').value;

        this.currentFilters = {
            priority: priority || null,
            category: category || null,
            completed: status === 'completed' ? 'true' : (status === 'pending' ? 'false' : null),
            due_after: dueAfter || null,
            due_before: dueBefore || null,
            created_after: createdAfter || null,
            created_before: createdBefore || null
        };

        // Remove null values
        Object.keys(this.currentFilters).forEach(key => {
            if (this.currentFilters[key] === null) {
                delete this.currentFilters[key];
            }
        });

        this.updateFilterCount();
        this.saveFilters();
        this.closeFilterPanel();
        this.taskManager.loadTasks();
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        // Reset filter inputs
        document.getElementById('priority-filter').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('due-after-filter').value = '';
        document.getElementById('due-before-filter').value = '';
        document.getElementById('created-after-filter').value = '';
        document.getElementById('created-before-filter').value = '';

        this.currentFilters = {};
        this.updateFilterCount();
        this.saveFilters();
        this.closeFilterPanel();
        this.taskManager.loadTasks();
    }

    /**
     * Update filter count badge
     */
    updateFilterCount() {
        const count = Object.keys(this.currentFilters).length;
        const badge = document.getElementById('filter-count');
        const toggle = document.getElementById('filter-toggle-btn');

        if (count > 0) {
            badge.textContent = count;
            badge.classList.remove('hidden');
            toggle.classList.add('active');
        } else {
            badge.classList.add('hidden');
            toggle.classList.remove('active');
        }
    }

    /**
     * Handle sort change
     */
    handleSortChange(value) {
        const [field, order] = value.split(':');
        this.currentSort = { field, order };
        this.saveSort();
        this.taskManager.loadTasks();
    }

    /**
     * Get current search and filter parameters for API
     */
    getApiParameters() {
        const params = { ...this.currentFilters };

        if (this.currentSearchTerm.trim()) {
            params.search = this.currentSearchTerm.trim();
        }

        params.sort = this.currentSort.field;
        params.order = this.currentSort.order;

        return params;
    }

    /**
     * Save filters to localStorage
     */
    saveFilters() {
        localStorage.setItem('taskFilters', JSON.stringify(this.currentFilters));
    }

    /**
     * Save sort preferences to localStorage
     */
    saveSort() {
        localStorage.setItem('taskSort', JSON.stringify(this.currentSort));
    }

    /**
     * Load saved filters from localStorage
     */
    loadSavedFilters() {
        try {
            const savedFilters = localStorage.getItem('taskFilters');
            const savedSort = localStorage.getItem('taskSort');

            if (savedFilters) {
                this.currentFilters = JSON.parse(savedFilters);
                this.populateFilterInputs();
                this.updateFilterCount();
            }

            if (savedSort) {
                this.currentSort = JSON.parse(savedSort);
                document.getElementById('sort-select').value = `${this.currentSort.field}:${this.currentSort.order}`;
            }
        } catch (error) {
            console.error('Failed to load saved filters:', error);
        }
    }

    /**
     * Populate filter inputs with saved values
     */
    populateFilterInputs() {
        if (this.currentFilters.priority) {
            document.getElementById('priority-filter').value = this.currentFilters.priority;
        }
        if (this.currentFilters.category) {
            document.getElementById('category-filter').value = this.currentFilters.category;
        }
        if (this.currentFilters.completed) {
            const status = this.currentFilters.completed === 'true' ? 'completed' : 'pending';
            document.getElementById('status-filter').value = status;
        }
        if (this.currentFilters.due_after) {
            document.getElementById('due-after-filter').value = this.currentFilters.due_after;
        }
        if (this.currentFilters.due_before) {
            document.getElementById('due-before-filter').value = this.currentFilters.due_before;
        }
        if (this.currentFilters.created_after) {
            document.getElementById('created-after-filter').value = this.currentFilters.created_after;
        }
        if (this.currentFilters.created_before) {
            document.getElementById('created-before-filter').value = this.currentFilters.created_before;
        }
    }

    /**
     * Reset all filters and search
     */
    reset() {
        this.clearSearch();
        this.clearAllFilters();
        this.currentSort = { field: 'created_at', order: 'desc' };
        document.getElementById('sort-select').value = 'created_at:desc';
        this.saveSort();
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export for use in other modules
window.SearchFilterManager = SearchFilterManager;