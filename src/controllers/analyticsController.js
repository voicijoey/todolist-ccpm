const AnalyticsService = require('../services/analyticsService');
const ExportService = require('../services/exportService');
const path = require('path');

class AnalyticsController {
  constructor() {
    this.analyticsService = new AnalyticsService();
    this.exportService = new ExportService();
  }

  /**
   * Get analytics overview
   * GET /api/analytics/overview
   */
  async getOverview(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      const overview = await this.analyticsService.getOverview(userId, startDate, endDate);

      res.json({
        success: true,
        data: {
          overview,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Analytics overview error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get analytics overview',
        error: error.message
      });
    }
  }

  /**
   * Get completion trends
   * GET /api/analytics/completion-trends
   */
  async getCompletionTrends(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate, interval = 'day' } = req.query;

      // Validate interval
      const validIntervals = ['hour', 'day', 'week', 'month'];
      if (!validIntervals.includes(interval)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid interval. Must be: hour, day, week, or month'
        });
      }

      const trends = await this.analyticsService.getCompletionTrends(userId, startDate, endDate, interval);

      res.json({
        success: true,
        data: {
          trends,
          interval,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Completion trends error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get completion trends',
        error: error.message
      });
    }
  }

  /**
   * Get category breakdown
   * GET /api/analytics/category-breakdown
   */
  async getCategoryBreakdown(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      const breakdown = await this.analyticsService.getCategoryBreakdown(userId, startDate, endDate);

      res.json({
        success: true,
        data: {
          categoryBreakdown: breakdown,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Category breakdown error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get category breakdown',
        error: error.message
      });
    }
  }

  /**
   * Get priority analysis
   * GET /api/analytics/priority-analysis
   */
  async getPriorityAnalysis(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      const analysis = await this.analyticsService.getPriorityAnalysis(userId, startDate, endDate);

      res.json({
        success: true,
        data: {
          priorityAnalysis: analysis,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Priority analysis error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get priority analysis',
        error: error.message
      });
    }
  }

  /**
   * Get productivity metrics
   * GET /api/analytics/productivity
   */
  async getProductivityMetrics(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      const metrics = await this.analyticsService.getProductivityMetrics(userId, startDate, endDate);

      res.json({
        success: true,
        data: {
          productivity: metrics,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Productivity metrics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get productivity metrics',
        error: error.message
      });
    }
  }

  /**
   * Get goal tracking
   * GET /api/analytics/goals
   */
  async getGoalTracking(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      const goals = await this.analyticsService.getGoalTracking(userId, startDate, endDate);

      res.json({
        success: true,
        data: {
          goals,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Goal tracking error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get goal tracking',
        error: error.message
      });
    }
  }

  /**
   * Get comprehensive analytics dashboard data
   * GET /api/analytics/dashboard
   */
  async getDashboard(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      // Get all analytics data in parallel
      const [overview, trends, categoryBreakdown, priorityAnalysis, productivity, goals] = await Promise.all([
        this.analyticsService.getOverview(userId, startDate, endDate),
        this.analyticsService.getCompletionTrends(userId, startDate, endDate, 'day'),
        this.analyticsService.getCategoryBreakdown(userId, startDate, endDate),
        this.analyticsService.getPriorityAnalysis(userId, startDate, endDate),
        this.analyticsService.getProductivityMetrics(userId, startDate, endDate),
        this.analyticsService.getGoalTracking(userId, startDate, endDate)
      ]);

      res.json({
        success: true,
        data: {
          overview,
          trends,
          categoryBreakdown,
          priorityAnalysis,
          productivity,
          goals,
          dateRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get dashboard data',
        error: error.message
      });
    }
  }

  /**
   * Export tasks to CSV
   * POST /api/analytics/export/csv
   */
  async exportCSV(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate, filters = {}, includeAnalytics = false } = req.body;

      const result = await this.exportService.exportToCSV(userId, {
        startDate,
        endDate,
        filters,
        includeAnalytics
      });

      res.json({
        success: true,
        message: 'CSV export completed successfully',
        data: {
          filename: result.filename,
          recordCount: result.recordCount,
          fileSize: result.fileSize,
          downloadUrl: `/api/analytics/download/${result.filename}`
        }
      });
    } catch (error) {
      console.error('CSV export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export CSV',
        error: error.message
      });
    }
  }

  /**
   * Export analytics to PDF
   * POST /api/analytics/export/pdf
   */
  async exportPDF(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate, reportType = 'comprehensive' } = req.body;

      const result = await this.exportService.exportToPDF(userId, {
        startDate,
        endDate,
        reportType
      });

      res.json({
        success: true,
        message: 'PDF export completed successfully',
        data: {
          filename: result.filename,
          fileSize: result.fileSize,
          downloadUrl: `/api/analytics/download/${result.filename}`
        }
      });
    } catch (error) {
      console.error('PDF export error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to export PDF',
        error: error.message
      });
    }
  }

  /**
   * Download exported file
   * GET /api/analytics/download/:filename
   */
  async downloadFile(req, res) {
    try {
      const { filename } = req.params;

      // Validate filename to prevent directory traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid filename'
        });
      }

      const fileInfo = this.exportService.getExportInfo(filename);

      // Set appropriate headers
      const fileExtension = path.extname(filename).toLowerCase();
      let contentType = 'application/octet-stream';

      if (fileExtension === '.csv') {
        contentType = 'text/csv';
      } else if (fileExtension === '.pdf') {
        contentType = 'application/pdf';
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileInfo.size);

      // Stream the file
      res.sendFile(fileInfo.filepath);
    } catch (error) {
      console.error('Download file error:', error);
      res.status(404).json({
        success: false,
        message: 'File not found or expired',
        error: error.message
      });
    }
  }

  /**
   * Get export history
   * GET /api/analytics/exports
   */
  async getExportHistory(req, res) {
    try {
      // This would typically come from a database, but for now we'll list files
      const fs = require('fs');
      const exportDir = path.join(__dirname, '../../data/exports');

      if (!fs.existsSync(exportDir)) {
        return res.json({
          success: true,
          data: { exports: [] }
        });
      }

      const files = fs.readdirSync(exportDir)
        .filter(file => file.includes(`_${req.user.userId}_`)) // Filter by user
        .map(file => {
          const filepath = path.join(exportDir, file);
          const stats = fs.statSync(filepath);
          const fileExtension = path.extname(file).toLowerCase();

          return {
            filename: file,
            type: fileExtension === '.csv' ? 'CSV' : fileExtension === '.pdf' ? 'PDF' : 'Unknown',
            size: stats.size,
            created: stats.birthtime,
            downloadUrl: `/api/analytics/download/${file}`
          };
        })
        .sort((a, b) => new Date(b.created) - new Date(a.created));

      res.json({
        success: true,
        data: { exports: files }
      });
    } catch (error) {
      console.error('Export history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get export history',
        error: error.message
      });
    }
  }

  /**
   * Clean up old exports
   * DELETE /api/analytics/exports/cleanup
   */
  async cleanupExports(req, res) {
    try {
      const { maxAgeHours = 24 } = req.body;

      const result = await this.exportService.cleanupOldExports(maxAgeHours);

      res.json({
        success: true,
        message: 'Export cleanup completed',
        data: result
      });
    } catch (error) {
      console.error('Export cleanup error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup exports',
        error: error.message
      });
    }
  }
}

module.exports = AnalyticsController;