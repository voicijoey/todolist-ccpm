const Database = require('../models/database');

class AnalyticsService {
  constructor() {
    this.db = new Database();
  }

  async ensureDbConnection() {
    if (!this.db.db) {
      await this.db.connect();
    }
  }

  /**
   * Get overall analytics overview
   */
  async getOverview(userId, startDate = null, endDate = null) {
    await this.ensureDbConnection();

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    // Get basic task statistics
    const totalTasksResult = await this.db.get(
      `SELECT COUNT(*) as total FROM tasks WHERE user_id = ? ${dateFilter}`,
      params
    );

    const completedTasksResult = await this.db.get(
      `SELECT COUNT(*) as completed FROM tasks WHERE user_id = ? AND completed = 1 ${dateFilter}`,
      params
    );

    const overdueTasksResult = await this.db.get(
      `SELECT COUNT(*) as overdue FROM tasks
       WHERE user_id = ? AND completed = 0 AND due_date < datetime('now') ${dateFilter}`,
      params
    );

    // Calculate average completion time
    const avgCompletionResult = await this.db.get(
      `SELECT AVG(julianday(updated_at) - julianday(created_at)) as avg_days
       FROM tasks
       WHERE user_id = ? AND completed = 1 ${dateFilter}`,
      params
    );

    const totalTasks = totalTasksResult.total;
    const completedTasks = completedTasksResult.completed;
    const overdueTasks = overdueTasksResult.overdue;
    const avgCompletionTime = avgCompletionResult.avg_days;

    return {
      total_tasks: totalTasks,
      completed_tasks: completedTasks,
      pending_tasks: totalTasks - completedTasks,
      completion_rate: totalTasks > 0 ? (completedTasks / totalTasks) : 0,
      overdue_tasks: overdueTasks,
      avg_completion_time: avgCompletionTime ? `${avgCompletionTime.toFixed(1)} days` : 'N/A'
    };
  }

  /**
   * Get completion trends over time
   */
  async getCompletionTrends(userId, startDate = null, endDate = null, interval = 'day') {
    await this.ensureDbConnection();

    let dateFilter = '';
    let dateFormat = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    // Set date format based on interval
    switch (interval) {
      case 'hour':
        dateFormat = "strftime('%Y-%m-%d %H:00:00', created_at)";
        break;
      case 'day':
        dateFormat = "date(created_at)";
        break;
      case 'week':
        dateFormat = "strftime('%Y-W%W', created_at)";
        break;
      case 'month':
        dateFormat = "strftime('%Y-%m', created_at)";
        break;
      default:
        dateFormat = "date(created_at)";
    }

    const trends = await this.db.all(
      `SELECT
         ${dateFormat} as period,
         COUNT(*) as total_tasks,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
         CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as completion_rate
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY ${dateFormat}
       ORDER BY period ASC`,
      params
    );

    return trends.map(trend => ({
      period: trend.period,
      total_tasks: trend.total_tasks,
      completed_tasks: trend.completed_tasks,
      pending_tasks: trend.total_tasks - trend.completed_tasks,
      completion_rate: trend.completion_rate || 0
    }));
  }

  /**
   * Get category breakdown analysis
   */
  async getCategoryBreakdown(userId, startDate = null, endDate = null) {
    await this.ensureDbConnection();

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    const breakdown = await this.db.all(
      `SELECT
         category,
         COUNT(*) as total,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
         CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as completion_rate,
         AVG(CASE WHEN completed = 1 THEN julianday(updated_at) - julianday(created_at) ELSE NULL END) as avg_completion_time
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY category
       ORDER BY total DESC`,
      params
    );

    return breakdown.map(cat => ({
      category: cat.category,
      total: cat.total,
      completed: cat.completed,
      pending: cat.total - cat.completed,
      completion_rate: cat.completion_rate || 0,
      avg_completion_time: cat.avg_completion_time ? `${cat.avg_completion_time.toFixed(1)} days` : 'N/A'
    }));
  }

  /**
   * Get priority analysis
   */
  async getPriorityAnalysis(userId, startDate = null, endDate = null) {
    await this.ensureDbConnection();

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    const analysis = await this.db.all(
      `SELECT
         priority,
         COUNT(*) as total,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
         CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as completion_rate,
         AVG(CASE WHEN completed = 1 THEN julianday(updated_at) - julianday(created_at) ELSE NULL END) as avg_completion_time,
         SUM(CASE WHEN completed = 0 AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY priority
       ORDER BY
         CASE priority
           WHEN 'high' THEN 1
           WHEN 'medium' THEN 2
           WHEN 'low' THEN 3
         END`,
      params
    );

    return analysis.map(pri => ({
      priority: pri.priority,
      total: pri.total,
      completed: pri.completed,
      pending: pri.total - pri.completed,
      completion_rate: pri.completion_rate || 0,
      avg_completion_time: pri.avg_completion_time ? `${pri.avg_completion_time.toFixed(1)} days` : 'N/A',
      overdue: pri.overdue
    }));
  }

  /**
   * Get productivity metrics
   */
  async getProductivityMetrics(userId, startDate = null, endDate = null) {
    await this.ensureDbConnection();

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    // Tasks created vs completed over time
    const dailyProductivity = await this.db.all(
      `SELECT
         date(created_at) as date,
         COUNT(*) as tasks_created,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as tasks_completed
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY date(created_at)
       ORDER BY date ASC`,
      params
    );

    // Most productive day of week
    const dayOfWeekProductivity = await this.db.all(
      `SELECT
         strftime('%w', created_at) as day_of_week,
         CASE strftime('%w', created_at)
           WHEN '0' THEN 'Sunday'
           WHEN '1' THEN 'Monday'
           WHEN '2' THEN 'Tuesday'
           WHEN '3' THEN 'Wednesday'
           WHEN '4' THEN 'Thursday'
           WHEN '5' THEN 'Friday'
           WHEN '6' THEN 'Saturday'
         END as day_name,
         COUNT(*) as total_tasks,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
         CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as completion_rate
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY strftime('%w', created_at)
       ORDER BY completion_rate DESC`,
      params
    );

    // Task creation vs completion velocity
    const velocity = await this.db.get(
      `SELECT
         COUNT(*) / CAST((julianday('now') - julianday(MIN(created_at))) AS FLOAT) as avg_tasks_per_day,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) / CAST((julianday('now') - julianday(MIN(created_at))) AS FLOAT) as avg_completion_per_day
       FROM tasks
       WHERE user_id = ? ${dateFilter}`,
      params
    );

    return {
      daily_productivity: dailyProductivity,
      day_of_week_analysis: dayOfWeekProductivity,
      velocity: {
        avg_tasks_created_per_day: velocity.avg_tasks_per_day ? velocity.avg_tasks_per_day.toFixed(2) : '0',
        avg_tasks_completed_per_day: velocity.avg_completion_per_day ? velocity.avg_completion_per_day.toFixed(2) : '0'
      }
    };
  }

  /**
   * Get goal achievement tracking
   */
  async getGoalTracking(userId, startDate = null, endDate = null) {
    await this.ensureDbConnection();

    let dateFilter = '';
    const params = [userId];

    if (startDate && endDate) {
      dateFilter = 'AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    // Tasks by due date adherence
    const dueDateAdherence = await this.db.all(
      `SELECT
         CASE
           WHEN due_date IS NULL THEN 'No Due Date'
           WHEN completed = 1 AND updated_at <= due_date THEN 'Completed On Time'
           WHEN completed = 1 AND updated_at > due_date THEN 'Completed Late'
           WHEN completed = 0 AND due_date >= datetime('now') THEN 'Pending On Time'
           WHEN completed = 0 AND due_date < datetime('now') THEN 'Overdue'
         END as status,
         COUNT(*) as count
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY status
       ORDER BY count DESC`,
      params
    );

    // Monthly goal achievement (assuming goal is to complete 80% of tasks)
    const monthlyGoals = await this.db.all(
      `SELECT
         strftime('%Y-%m', created_at) as month,
         COUNT(*) as total_tasks,
         SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
         CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as completion_rate,
         CASE WHEN CAST(SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) >= 0.8
              THEN 'Goal Achieved'
              ELSE 'Goal Missed'
         END as goal_status
       FROM tasks
       WHERE user_id = ? ${dateFilter}
       GROUP BY strftime('%Y-%m', created_at)
       ORDER BY month DESC`,
      params
    );

    return {
      due_date_adherence: dueDateAdherence,
      monthly_goals: monthlyGoals,
      goal_threshold: 0.8
    };
  }

  /**
   * Get raw task data for export
   */
  async getTasksForExport(userId, startDate = null, endDate = null, filters = {}) {
    await this.ensureDbConnection();

    let whereClause = 'WHERE user_id = ?';
    const params = [userId];

    if (startDate && endDate) {
      whereClause += ' AND created_at >= ? AND created_at <= ?';
      params.push(startDate, endDate);
    }

    if (filters.completed !== undefined) {
      whereClause += ' AND completed = ?';
      params.push(filters.completed ? 1 : 0);
    }

    if (filters.priority) {
      whereClause += ' AND priority = ?';
      params.push(filters.priority);
    }

    if (filters.category) {
      whereClause += ' AND category = ?';
      params.push(filters.category);
    }

    const tasks = await this.db.all(
      `SELECT
         id,
         title,
         description,
         CASE WHEN completed = 1 THEN 'Yes' ELSE 'No' END as completed,
         priority,
         category,
         due_date,
         created_at,
         updated_at,
         CASE
           WHEN completed = 1 THEN julianday(updated_at) - julianday(created_at)
           ELSE NULL
         END as completion_time_days
       FROM tasks
       ${whereClause}
       ORDER BY created_at DESC`,
      params
    );

    return tasks;
  }
}

module.exports = AnalyticsService;