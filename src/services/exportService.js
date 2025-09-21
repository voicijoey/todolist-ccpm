const fs = require('fs');
const path = require('path');
const csvWriter = require('csv-writer');
const puppeteer = require('puppeteer');
const AnalyticsService = require('./analyticsService');

class ExportService {
  constructor() {
    this.analyticsService = new AnalyticsService();
    this.exportsDir = path.join(__dirname, '../../data/exports');

    // Ensure exports directory exists
    if (!fs.existsSync(this.exportsDir)) {
      fs.mkdirSync(this.exportsDir, { recursive: true });
    }
  }

  /**
   * Export tasks to CSV format
   */
  async exportToCSV(userId, options = {}) {
    const {
      startDate = null,
      endDate = null,
      filters = {},
      includeAnalytics = false
    } = options;

    try {
      // Get task data
      const tasks = await this.analyticsService.getTasksForExport(userId, startDate, endDate, filters);

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `tasks_export_${userId}_${timestamp}.csv`;
      const filepath = path.join(this.exportsDir, filename);

      // Define CSV headers
      const headers = [
        { id: 'id', title: 'Task ID' },
        { id: 'title', title: 'Title' },
        { id: 'description', title: 'Description' },
        { id: 'completed', title: 'Completed' },
        { id: 'priority', title: 'Priority' },
        { id: 'category', title: 'Category' },
        { id: 'due_date', title: 'Due Date' },
        { id: 'created_at', title: 'Created At' },
        { id: 'updated_at', title: 'Updated At' },
        { id: 'completion_time_days', title: 'Completion Time (Days)' }
      ];

      // Create CSV writer
      const writer = csvWriter.createObjectCsvWriter({
        path: filepath,
        header: headers
      });

      // Write task data
      await writer.writeRecords(tasks);

      // If analytics are requested, append analytics data
      if (includeAnalytics) {
        await this.appendAnalyticsToCSV(filepath, userId, startDate, endDate);
      }

      return {
        filename,
        filepath,
        recordCount: tasks.length,
        fileSize: fs.statSync(filepath).size
      };

    } catch (error) {
      console.error('CSV export error:', error);
      throw new Error(`Failed to export to CSV: ${error.message}`);
    }
  }

  /**
   * Append analytics summary to CSV file
   */
  async appendAnalyticsToCSV(filepath, userId, startDate, endDate) {
    try {
      const [overview, categoryBreakdown, priorityAnalysis] = await Promise.all([
        this.analyticsService.getOverview(userId, startDate, endDate),
        this.analyticsService.getCategoryBreakdown(userId, startDate, endDate),
        this.analyticsService.getPriorityAnalysis(userId, startDate, endDate)
      ]);

      const analyticsData = [
        '\n\n--- ANALYTICS SUMMARY ---',
        `Total Tasks,${overview.total_tasks}`,
        `Completed Tasks,${overview.completed_tasks}`,
        `Completion Rate,${(overview.completion_rate * 100).toFixed(1)}%`,
        `Overdue Tasks,${overview.overdue_tasks}`,
        `Average Completion Time,${overview.avg_completion_time}`,
        '\n--- CATEGORY BREAKDOWN ---',
        'Category,Total,Completed,Completion Rate'
      ];

      categoryBreakdown.forEach(cat => {
        analyticsData.push(`${cat.category},${cat.total},${cat.completed},${(cat.completion_rate * 100).toFixed(1)}%`);
      });

      analyticsData.push('\n--- PRIORITY ANALYSIS ---');
      analyticsData.push('Priority,Total,Completed,Completion Rate,Overdue');

      priorityAnalysis.forEach(pri => {
        analyticsData.push(`${pri.priority},${pri.total},${pri.completed},${(pri.completion_rate * 100).toFixed(1)}%,${pri.overdue}`);
      });

      // Append to file
      fs.appendFileSync(filepath, analyticsData.join('\n'));

    } catch (error) {
      console.error('Error appending analytics to CSV:', error);
      // Don't throw error, just log it since main export succeeded
    }
  }

  /**
   * Export analytics report to PDF
   */
  async exportToPDF(userId, options = {}) {
    const {
      startDate = null,
      endDate = null,
      reportType = 'comprehensive'
    } = options;

    try {
      // Get analytics data
      const [overview, trends, categoryBreakdown, priorityAnalysis, productivity, goals] = await Promise.all([
        this.analyticsService.getOverview(userId, startDate, endDate),
        this.analyticsService.getCompletionTrends(userId, startDate, endDate, 'day'),
        this.analyticsService.getCategoryBreakdown(userId, startDate, endDate),
        this.analyticsService.getPriorityAnalysis(userId, startDate, endDate),
        this.analyticsService.getProductivityMetrics(userId, startDate, endDate),
        this.analyticsService.getGoalTracking(userId, startDate, endDate)
      ]);

      // Generate HTML report
      const htmlContent = await this.generateHTMLReport({
        overview,
        trends,
        categoryBreakdown,
        priorityAnalysis,
        productivity,
        goals,
        startDate,
        endDate,
        reportType
      });

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `analytics_report_${userId}_${timestamp}.pdf`;
      const filepath = path.join(this.exportsDir, filename);

      // Generate PDF using Puppeteer
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();

      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      await page.emulateMediaType('print');

      await page.pdf({
        path: filepath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          bottom: '1cm',
          left: '1cm',
          right: '1cm'
        }
      });

      await browser.close();

      return {
        filename,
        filepath,
        fileSize: fs.statSync(filepath).size
      };

    } catch (error) {
      console.error('PDF export error:', error);
      throw new Error(`Failed to export to PDF: ${error.message}`);
    }
  }

  /**
   * Generate HTML content for PDF report
   */
  async generateHTMLReport(data) {
    const { overview, trends, categoryBreakdown, priorityAnalysis, productivity, goals, startDate, endDate, reportType } = data;

    const dateRange = startDate && endDate
      ? `${startDate} to ${endDate}`
      : 'All Time';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Task Analytics Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            border-bottom: 2px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #007bff;
            margin: 0;
        }
        .date-range {
            color: #666;
            font-size: 14px;
            margin-top: 5px;
        }
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .section h2 {
            color: #007bff;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            border-left: 4px solid #007bff;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #007bff;
        }
        .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th, td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background-color: #f8f9fa;
            font-weight: bold;
        }
        .progress-bar {
            background-color: #e9ecef;
            border-radius: 3px;
            height: 20px;
            overflow: hidden;
        }
        .progress-fill {
            background-color: #007bff;
            height: 100%;
            transition: width 0.3s ease;
        }
        .status-badge {
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: bold;
        }
        .status-achieved { background-color: #d4edda; color: #155724; }
        .status-missed { background-color: #f8d7da; color: #721c24; }
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Task Analytics Report</h1>
        <div class="date-range">Report Period: ${dateRange}</div>
        <div class="date-range">Generated: ${new Date().toLocaleString()}</div>
    </div>

    <div class="section">
        <h2>📊 Overview</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${overview.total_tasks}</div>
                <div class="metric-label">Total Tasks</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${overview.completed_tasks}</div>
                <div class="metric-label">Completed Tasks</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(overview.completion_rate * 100).toFixed(1)}%</div>
                <div class="metric-label">Completion Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${overview.overdue_tasks}</div>
                <div class="metric-label">Overdue Tasks</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${overview.avg_completion_time}</div>
                <div class="metric-label">Avg Completion Time</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>📈 Category Performance</h2>
        <table>
            <thead>
                <tr>
                    <th>Category</th>
                    <th>Total</th>
                    <th>Completed</th>
                    <th>Completion Rate</th>
                    <th>Progress</th>
                </tr>
            </thead>
            <tbody>
                ${categoryBreakdown.map(cat => `
                <tr>
                    <td>${cat.category}</td>
                    <td>${cat.total}</td>
                    <td>${cat.completed}</td>
                    <td>${(cat.completion_rate * 100).toFixed(1)}%</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${cat.completion_rate * 100}%"></div>
                        </div>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>⚡ Priority Analysis</h2>
        <table>
            <thead>
                <tr>
                    <th>Priority</th>
                    <th>Total</th>
                    <th>Completed</th>
                    <th>Completion Rate</th>
                    <th>Overdue</th>
                </tr>
            </thead>
            <tbody>
                ${priorityAnalysis.map(pri => `
                <tr>
                    <td>${pri.priority.toUpperCase()}</td>
                    <td>${pri.total}</td>
                    <td>${pri.completed}</td>
                    <td>${(pri.completion_rate * 100).toFixed(1)}%</td>
                    <td>${pri.overdue}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>🚀 Productivity Metrics</h2>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-value">${productivity.velocity.avg_tasks_created_per_day}</div>
                <div class="metric-label">Avg Tasks Created/Day</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${productivity.velocity.avg_tasks_completed_per_day}</div>
                <div class="metric-label">Avg Tasks Completed/Day</div>
            </div>
        </div>

        <h3>Most Productive Days</h3>
        <table>
            <thead>
                <tr>
                    <th>Day of Week</th>
                    <th>Total Tasks</th>
                    <th>Completed</th>
                    <th>Completion Rate</th>
                </tr>
            </thead>
            <tbody>
                ${productivity.day_of_week_analysis.map(day => `
                <tr>
                    <td>${day.day_name}</td>
                    <td>${day.total_tasks}</td>
                    <td>${day.completed_tasks}</td>
                    <td>${(day.completion_rate * 100).toFixed(1)}%</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>🎯 Goal Achievement</h2>
        <h3>Due Date Adherence</h3>
        <table>
            <thead>
                <tr>
                    <th>Status</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
                ${goals.due_date_adherence.map(item => `
                <tr>
                    <td>${item.status}</td>
                    <td>${item.count}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <h3>Monthly Goal Achievement (80% target)</h3>
        <table>
            <thead>
                <tr>
                    <th>Month</th>
                    <th>Total Tasks</th>
                    <th>Completed</th>
                    <th>Rate</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${goals.monthly_goals.map(goal => `
                <tr>
                    <td>${goal.month}</td>
                    <td>${goal.total_tasks}</td>
                    <td>${goal.completed_tasks}</td>
                    <td>${(goal.completion_rate * 100).toFixed(1)}%</td>
                    <td>
                        <span class="status-badge ${goal.goal_status === 'Goal Achieved' ? 'status-achieved' : 'status-missed'}">
                            ${goal.goal_status}
                        </span>
                    </td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="footer">
        <p>This report was generated automatically by the Task Analytics System</p>
    </div>
</body>
</html>`;
  }

  /**
   * Clean up old export files
   */
  async cleanupOldExports(maxAgeHours = 24) {
    try {
      const files = fs.readdirSync(this.exportsDir);
      const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
      let deletedCount = 0;

      for (const file of files) {
        const filepath = path.join(this.exportsDir, file);
        const stats = fs.statSync(filepath);

        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filepath);
          deletedCount++;
        }
      }

      return { deletedCount };
    } catch (error) {
      console.error('Cleanup error:', error);
      return { deletedCount: 0, error: error.message };
    }
  }

  /**
   * Get export file info
   */
  getExportInfo(filename) {
    const filepath = path.join(this.exportsDir, filename);

    if (!fs.existsSync(filepath)) {
      throw new Error('Export file not found');
    }

    const stats = fs.statSync(filepath);
    return {
      filename,
      filepath,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }
}

module.exports = ExportService;