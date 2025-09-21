const express = require('express');
const { body, query } = require('express-validator');
const AnalyticsController = require('../controllers/analyticsController');
const { authenticateToken } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();
const analyticsController = new AnalyticsController();

// Date validation helper
const dateValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('startDate must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('endDate must be a valid ISO 8601 date')
    .custom((endDate, { req }) => {
      if (req.query.startDate && endDate) {
        const start = new Date(req.query.startDate);
        const end = new Date(endDate);
        if (end <= start) {
          throw new Error('endDate must be after startDate');
        }
      }
      return true;
    })
];

/**
 * @route   GET /api/analytics/overview
 * @desc    Get analytics overview
 * @access  Private
 */
router.get('/overview',
  authenticateToken,
  dateValidation,
  handleValidationErrors,
  analyticsController.getOverview.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/completion-trends
 * @desc    Get completion trends over time
 * @access  Private
 */
router.get('/completion-trends',
  authenticateToken,
  [
    ...dateValidation,
    query('interval')
      .optional()
      .isIn(['hour', 'day', 'week', 'month'])
      .withMessage('interval must be: hour, day, week, or month')
  ],
  handleValidationErrors,
  analyticsController.getCompletionTrends.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/category-breakdown
 * @desc    Get category performance breakdown
 * @access  Private
 */
router.get('/category-breakdown',
  authenticateToken,
  dateValidation,
  handleValidationErrors,
  analyticsController.getCategoryBreakdown.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/priority-analysis
 * @desc    Get priority distribution analysis
 * @access  Private
 */
router.get('/priority-analysis',
  authenticateToken,
  dateValidation,
  handleValidationErrors,
  analyticsController.getPriorityAnalysis.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/productivity
 * @desc    Get productivity metrics
 * @access  Private
 */
router.get('/productivity',
  authenticateToken,
  dateValidation,
  handleValidationErrors,
  analyticsController.getProductivityMetrics.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/goals
 * @desc    Get goal achievement tracking
 * @access  Private
 */
router.get('/goals',
  authenticateToken,
  dateValidation,
  handleValidationErrors,
  analyticsController.getGoalTracking.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/dashboard
 * @desc    Get comprehensive dashboard data
 * @access  Private
 */
router.get('/dashboard',
  authenticateToken,
  dateValidation,
  handleValidationErrors,
  analyticsController.getDashboard.bind(analyticsController)
);

/**
 * @route   POST /api/analytics/export/csv
 * @desc    Export tasks to CSV
 * @access  Private
 */
router.post('/export/csv',
  authenticateToken,
  [
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date'),
    body('filters')
      .optional()
      .isObject()
      .withMessage('filters must be an object'),
    body('filters.completed')
      .optional()
      .isBoolean()
      .withMessage('filters.completed must be a boolean'),
    body('filters.priority')
      .optional()
      .isIn(['high', 'medium', 'low'])
      .withMessage('filters.priority must be: high, medium, or low'),
    body('filters.category')
      .optional()
      .isIn(['sales', 'operations', 'finance', 'general'])
      .withMessage('filters.category must be: sales, operations, finance, or general'),
    body('includeAnalytics')
      .optional()
      .isBoolean()
      .withMessage('includeAnalytics must be a boolean')
  ],
  handleValidationErrors,
  analyticsController.exportCSV.bind(analyticsController)
);

/**
 * @route   POST /api/analytics/export/pdf
 * @desc    Export analytics to PDF
 * @access  Private
 */
router.post('/export/pdf',
  authenticateToken,
  [
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date'),
    body('reportType')
      .optional()
      .isIn(['comprehensive', 'summary', 'detailed'])
      .withMessage('reportType must be: comprehensive, summary, or detailed')
  ],
  handleValidationErrors,
  analyticsController.exportPDF.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/download/:filename
 * @desc    Download exported file
 * @access  Private
 */
router.get('/download/:filename',
  authenticateToken,
  analyticsController.downloadFile.bind(analyticsController)
);

/**
 * @route   GET /api/analytics/exports
 * @desc    Get export history
 * @access  Private
 */
router.get('/exports',
  authenticateToken,
  analyticsController.getExportHistory.bind(analyticsController)
);

/**
 * @route   DELETE /api/analytics/exports/cleanup
 * @desc    Clean up old exports
 * @access  Private
 */
router.delete('/exports/cleanup',
  authenticateToken,
  [
    body('maxAgeHours')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('maxAgeHours must be between 1 and 168 (1 week)')
  ],
  handleValidationErrors,
  analyticsController.cleanupExports.bind(analyticsController)
);

module.exports = router;