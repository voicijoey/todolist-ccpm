const express = require('express');
const TaskController = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/auth');
const { validationRules, handleValidationErrors } = require('../middleware/validation');
const { query, body } = require('express-validator');

const router = express.Router();
const taskController = new TaskController();

// Enhanced validation rules for tasks
const taskQueryValidation = [
  query('completed')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Completed must be true or false'),
  query('priority')
    .optional()
    .isIn(['high', 'medium', 'low'])
    .withMessage('Priority must be one of: high, medium, low'),
  query('category')
    .optional()
    .isIn(['sales', 'operations', 'finance', 'general'])
    .withMessage('Category must be one of: sales, operations, finance, general'),
  query('sort')
    .optional()
    .isIn(['due_date', 'created_at', 'title', 'priority', 'category', 'completed'])
    .withMessage('Sort must be one of: due_date, created_at, title, priority, category, completed'),
  query('order')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Order must be asc or desc'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be 0 or greater')
];

const bulkOperationValidation = [
  body('operation')
    .isIn(['delete', 'update', 'complete', 'incomplete'])
    .withMessage('Operation must be one of: delete, update, complete, incomplete'),
  body('taskIds')
    .isArray({ min: 1 })
    .withMessage('TaskIds must be a non-empty array'),
  body('taskIds.*')
    .isInt({ min: 1 })
    .withMessage('Each task ID must be a positive integer'),
  body('updates')
    .optional()
    .isObject()
    .withMessage('Updates must be an object'),
  body('updates.completed')
    .optional()
    .isBoolean()
    .withMessage('Updates.completed must be a boolean'),
  body('updates.priority')
    .optional()
    .isIn(['high', 'medium', 'low'])
    .withMessage('Updates.priority must be one of: high, medium, low'),
  body('updates.category')
    .optional()
    .isIn(['sales', 'operations', 'finance', 'general'])
    .withMessage('Updates.category must be one of: sales, operations, finance, general')
];

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route   GET /api/tasks
 * @desc    Get all tasks for authenticated user with filtering, sorting, and pagination
 * @access  Private
 * @query   completed - Filter by completion status (true/false)
 * @query   priority - Filter by priority (high/medium/low)
 * @query   category - Filter by category (sales/operations/finance/general)
 * @query   sort - Sort field (due_date, created_at, title, priority, category, completed)
 * @query   order - Sort order (asc/desc)
 * @query   limit - Number of results per page (1-100, default: 50)
 * @query   offset - Number of results to skip (default: 0)
 */
router.get('/',
  taskQueryValidation,
  handleValidationErrors,
  async (req, res) => {
    await taskController.getTasks(req, res);
  }
);

/**
 * @route   GET /api/tasks/search/suggestions
 * @desc    Get search suggestions for authenticated user
 * @access  Private
 */
router.get('/search/suggestions',
  async (req, res) => {
    await taskController.getSearchSuggestions(req, res);
  }
);

/**
 * @route   GET /api/tasks/search/history
 * @desc    Get search history for authenticated user
 * @access  Private
 */
router.get('/search/history',
  async (req, res) => {
    await taskController.getSearchHistory(req, res);
  }
);

/**
 * @route   DELETE /api/tasks/search/history
 * @desc    Clear search history for authenticated user
 * @access  Private
 */
router.delete('/search/history',
  async (req, res) => {
    await taskController.clearSearchHistory(req, res);
  }
);

/**
 * @route   GET /api/tasks/stats
 * @desc    Get task statistics for authenticated user
 * @access  Private
 */
router.get('/stats',
  async (req, res) => {
    await taskController.getStats(req, res);
  }
);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @access  Private
 * @body    title - Task title (required, 1-200 chars)
 * @body    description - Task description (optional, max 1000 chars)
 * @body    priority - Task priority (optional, high/medium/low, default: medium)
 * @body    category - Task category (optional, sales/operations/finance/general, default: general)
 * @body    dueDate - Due date (optional, ISO 8601 format)
 */
router.post('/',
  validationRules.taskCreation,
  handleValidationErrors,
  async (req, res) => {
    await taskController.createTask(req, res);
  }
);

/**
 * @route   POST /api/tasks/bulk
 * @desc    Perform bulk operations on tasks
 * @access  Private
 * @body    operation - Operation type (delete, update, complete, incomplete)
 * @body    taskIds - Array of task IDs to operate on
 * @body    updates - Update object (required for 'update' operation)
 */
router.post('/bulk',
  bulkOperationValidation,
  handleValidationErrors,
  async (req, res) => {
    await taskController.bulkOperations(req, res);
  }
);

/**
 * @route   GET /api/tasks/:id
 * @desc    Get a specific task by ID
 * @access  Private
 * @param   id - Task ID (positive integer)
 */
router.get('/:id',
  validationRules.idParam,
  handleValidationErrors,
  async (req, res) => {
    await taskController.getTask(req, res);
  }
);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @access  Private
 * @param   id - Task ID (positive integer)
 * @body    title - Task title (optional, 1-200 chars)
 * @body    description - Task description (optional, max 1000 chars)
 * @body    completed - Completion status (optional, boolean)
 * @body    priority - Task priority (optional, high/medium/low)
 * @body    category - Task category (optional, sales/operations/finance/general)
 * @body    dueDate - Due date (optional, ISO 8601 format)
 */
router.put('/:id',
  validationRules.idParam,
  validationRules.taskUpdate,
  handleValidationErrors,
  async (req, res) => {
    await taskController.updateTask(req, res);
  }
);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task
 * @access  Private
 * @param   id - Task ID (positive integer)
 */
router.delete('/:id',
  validationRules.idParam,
  handleValidationErrors,
  async (req, res) => {
    await taskController.deleteTask(req, res);
  }
);

module.exports = router;
