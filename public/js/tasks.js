/**
 * Task Management Component for Epic Todo List
 * Handles task CRUD operations, filtering, and UI interactions
 */

class TaskManager {
    constructor() {
        this.tasks = [];
        this.currentFilter = 'all'; // all, pending, completed
        this.editingTaskId = null;
        this.searchFilterManager = null;
        this.init();
    }

    /**
     * Initialize task manager
     */
    init() {
        this.bindEvents();
        // Initialize search and filter manager after DOM is ready
        if (window.SearchFilterManager) {
            this.searchFilterManager = new window.SearchFilterManager(this);
        }
    }

    /**
     * Bind task-related event listeners
     */
    bindEvents() {
        // Add task button
        document.getElementById('add-task-btn').addEventListener('click', () => {
            this.showTaskModal();
        });

        // Modal events
        document.getElementById('close-modal').addEventListener('click', () => {
            this.hideTaskModal();
        });

        document.getElementById('cancel-task').addEventListener('click', () => {
            this.hideTaskModal();
        });

        // Click outside modal to close
        document.getElementById('task-modal').addEventListener('click', (e) => {
            if (e.target.id === 'task-modal') {
                this.hideTaskModal();
            }
        });

        // Task form submission
        document.getElementById('task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleTaskSubmit(e);
        });

        // Retry button for error state
        document.getElementById('retry-btn').addEventListener('click', () => {
            this.loadTasks();
        });

        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideTaskModal();
            }
        });
    }

    /**
     * Load all tasks from API with search and filter parameters
     */
    async loadTasks() {
        this.showLoading();

        try {
            let params = {};

            // Get search and filter parameters if search filter manager is available
            if (this.searchFilterManager) {
                params = this.searchFilterManager.getApiParameters();
            }

            const response = await window.api.getTasks(params);

            // Handle different response structures
            if (response.data && response.data.tasks) {
                this.tasks = response.data.tasks;
            } else if (response.tasks) {
                this.tasks = response.tasks;
            } else {
                this.tasks = response || [];
            }

            this.renderTasks();
        } catch (error) {
            console.error('Failed to load tasks:', error);
            this.showError('Failed to load tasks. Please try again.');
        }
    }

    /**
     * Set task filter and update UI
     */
    setFilter(filter) {
        this.currentFilter = filter;
        this.renderTasks();
    }

    /**
     * Filter tasks based on current filter
     */
    filterTasks() {
        switch (this.currentFilter) {
            case 'pending':
                return this.tasks.filter(task => !task.completed);
            case 'completed':
                return this.tasks.filter(task => task.completed);
            default:
                return this.tasks;
        }
    }

    /**
     * Render tasks in the UI
     */
    renderTasks() {
        const taskList = document.getElementById('task-list');
        const filteredTasks = this.filterTasks();

        // Hide loading and error states
        this.hideLoading();
        this.hideError();

        // Show empty state if no tasks
        if (filteredTasks.length === 0) {
            this.showEmpty();
            taskList.innerHTML = '';
            return;
        }

        // Hide empty state
        this.hideEmpty();

        // Tasks are already sorted by the server, so just render them
        taskList.innerHTML = filteredTasks.map(task => this.renderTaskItem(task)).join('');

        // Bind task-specific events
        this.bindTaskEvents();
    }

    /**
     * Render individual task item
     */
    renderTaskItem(task) {
        const isOverdue = task.due_date && new Date(task.due_date) < new Date() && !task.completed;
        const isDueSoon = task.due_date &&
            new Date(task.due_date) > new Date() &&
            new Date(task.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) &&
            !task.completed;

        const dueDateClass = isOverdue ? 'overdue' : (isDueSoon ? 'due-soon' : '');
        const dueDateText = task.due_date ?
            `Due: ${new Date(task.due_date).toLocaleDateString()} ${new Date(task.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}` :
            '';

        return `
            <div class="task-item ${task.completed ? 'completed' : ''}" data-task-id="${task.id}">
                <div class="task-header">
                    <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}
                           data-task-id="${task.id}">
                    <div class="task-content">
                        <h3 class="task-title">${this.escapeHtml(task.title)}</h3>
                        ${task.description ? `<p class="task-description">${this.escapeHtml(task.description)}</p>` : ''}
                        <div class="task-meta">
                            <span class="task-priority ${task.priority}">${task.priority.toUpperCase()}</span>
                            <span class="task-category ${task.category || 'general'}">${(task.category || 'general').toUpperCase()}</span>
                            ${dueDateText ? `<span class="task-due-date ${dueDateClass}">${dueDateText}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn btn-sm btn-secondary edit-task" data-task-id="${task.id}">
                        Edit
                    </button>
                    <button class="btn btn-sm btn-danger delete-task" data-task-id="${task.id}">
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bind events for task items (checkboxes, edit, delete)
     */
    bindTaskEvents() {
        // Task completion checkboxes
        document.querySelectorAll('.task-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const taskId = parseInt(e.target.dataset.taskId);
                const completed = e.target.checked;
                this.toggleTask(taskId, completed);
            });
        });

        // Edit task buttons
        document.querySelectorAll('.edit-task').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = parseInt(e.target.dataset.taskId);
                this.editTask(taskId);
            });
        });

        // Delete task buttons
        document.querySelectorAll('.delete-task').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = parseInt(e.target.dataset.taskId);
                this.deleteTask(taskId);
            });
        });
    }

    /**
     * Show task modal for adding or editing
     */
    showTaskModal(task = null) {
        const modal = document.getElementById('task-modal');
        const form = document.getElementById('task-form');
        const modalTitle = document.getElementById('modal-title');

        if (task) {
            // Editing existing task
            modalTitle.textContent = 'Edit Task';
            this.editingTaskId = task.id;

            // Populate form fields
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-description').value = task.description || '';
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-category').value = task.category || 'general';

            // Format due date for datetime-local input
            if (task.due_date) {
                const date = new Date(task.due_date);
                const localISOTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                document.getElementById('task-due-date').value = localISOTime;
            } else {
                document.getElementById('task-due-date').value = '';
            }
        } else {
            // Adding new task
            modalTitle.textContent = 'Add New Task';
            this.editingTaskId = null;
            form.reset();
            document.getElementById('task-priority').value = 'medium'; // Default priority
            document.getElementById('task-category').value = 'general'; // Default category
        }

        modal.classList.remove('hidden');
        document.getElementById('task-title').focus();
    }

    /**
     * Hide task modal
     */
    hideTaskModal() {
        const modal = document.getElementById('task-modal');
        modal.classList.add('hidden');
        this.editingTaskId = null;
        this.clearFormErrors();
    }

    /**
     * Handle task form submission
     */
    async handleTaskSubmit(event) {
        const formData = new FormData(event.target);
        const taskData = {
            title: formData.get('title') || document.getElementById('task-title').value,
            description: formData.get('description') || document.getElementById('task-description').value,
            priority: formData.get('priority') || document.getElementById('task-priority').value,
            category: formData.get('category') || document.getElementById('task-category').value,
            dueDate: formData.get('due_date') || document.getElementById('task-due-date').value
        };

        // Clear previous errors
        this.clearFormErrors();

        // Validate required fields
        if (!taskData.title.trim()) {
            this.showFormError('task-title', 'Title is required');
            return;
        }

        // Convert empty dueDate to null
        if (!taskData.dueDate) {
            taskData.dueDate = null;
        }

        try {
            if (this.editingTaskId) {
                // Update existing task
                await window.api.updateTask(this.editingTaskId, taskData);
                window.toast.show('Task updated successfully!', 'success');
            } else {
                // Create new task
                await window.api.createTask(taskData);
                window.toast.show('Task created successfully!', 'success');
            }

            this.hideTaskModal();
            await this.loadTasks();
        } catch (error) {
            console.error('Failed to save task:', error);
            this.showFormError('task-title', error.message);
        }
    }

    /**
     * Toggle task completion status
     */
    async toggleTask(taskId, completed) {
        try {
            await window.api.toggleTask(taskId, completed);

            // Update local task data
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = completed;
            }

            this.renderTasks();

            const message = completed ? 'Task completed!' : 'Task marked as pending';
            window.toast.show(message, 'success');
        } catch (error) {
            console.error('Failed to toggle task:', error);
            window.toast.show('Failed to update task', 'error');

            // Revert checkbox state
            const checkbox = document.querySelector(`[data-task-id="${taskId}"]`);
            if (checkbox) {
                checkbox.checked = !completed;
            }
        }
    }

    /**
     * Edit existing task
     */
    editTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) {
            this.showTaskModal(task);
        }
    }

    /**
     * Delete task with confirmation
     */
    async deleteTask(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        if (!confirm(`Are you sure you want to delete "${task.title}"?`)) {
            return;
        }

        try {
            await window.api.deleteTask(taskId);
            window.toast.show('Task deleted successfully!', 'success');
            await this.loadTasks();
        } catch (error) {
            console.error('Failed to delete task:', error);
            window.toast.show('Failed to delete task', 'error');
        }
    }

    /**
     * Clear all tasks (used on logout)
     */
    clearTasks() {
        this.tasks = [];
        this.renderTasks();
    }

    /**
     * Show loading state
     */
    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        this.hideEmpty();
        this.hideError();
    }

    /**
     * Hide loading state
     */
    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    /**
     * Show empty state
     */
    showEmpty() {
        document.getElementById('empty-state').classList.remove('hidden');
    }

    /**
     * Hide empty state
     */
    hideEmpty() {
        document.getElementById('empty-state').classList.add('hidden');
    }

    /**
     * Show error state
     */
    showError(message) {
        document.getElementById('error-state').classList.remove('hidden');
        document.getElementById('error-message').textContent = message;
        this.hideLoading();
        this.hideEmpty();
    }

    /**
     * Hide error state
     */
    hideError() {
        document.getElementById('error-state').classList.add('hidden');
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
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize task manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.taskManager = new TaskManager();
});