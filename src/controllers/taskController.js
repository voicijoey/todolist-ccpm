const Database = require('../models/database');

// Create database instance
const db = new Database();

// Helper function to connect to database
async function ensureDbConnection() {
  if (!db.db) {
    await db.connect();
  }
}

class TaskController {

  /**
   * Create a new task
   * POST /api/tasks
   */
  async createTask(req, res) {
    try {
      await ensureDbConnection();
      const { title, description, priority = 'medium', category = 'general', dueDate } = req.body;
      const userId = req.user.userId;

      const result = await db.run(
        `INSERT INTO tasks (user_id, title, description, priority, category, due_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [userId, title, description || null, priority, category, dueDate || null]
      );

      // Fetch the created task
      const task = await db.get(
        'SELECT * FROM tasks WHERE id = ?',
        [result.id]
      );

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: {
          task: this.formatTask(task)
        }
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create task',
        error: error.message
      });
    }
  }

  /**
   * Get all tasks for the authenticated user with search and filtering
   * GET /api/tasks
   */
  async getTasks(req, res) {
    try {
      await ensureDbConnection();
      const userId = req.user.userId;
      const {
        search,
        completed,
        priority,
        category,
        due_after,
        due_before,
        created_after,
        created_before,
        sort = 'created_at',
        order = 'desc',
        limit = 50,
        offset = 0
      } = req.query;

      // Build query with filters
      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      // Full-text search across title and description
      if (search && search.trim()) {
        const searchTerm = `%${search.trim()}%`;
        whereClause += ' AND (title LIKE ? OR description LIKE ?)';
        params.push(searchTerm, searchTerm);

        // Track search history (async, don't wait)
        this.trackSearchHistory(userId, search.trim()).catch(err =>
          console.error('Failed to track search:', err)
        );
      }

      if (completed !== undefined) {
        whereClause += ' AND completed = ?';
        params.push(completed === 'true' ? 1 : 0);
      }

      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      // Date range filtering
      if (due_after) {
        whereClause += ' AND due_date >= ?';
        params.push(due_after);
      }

      if (due_before) {
        whereClause += ' AND due_date <= ?';
        params.push(due_before);
      }

      if (created_after) {
        whereClause += ' AND created_at >= ?';
        params.push(created_after);
      }

      if (created_before) {
        whereClause += ' AND created_at <= ?';
        params.push(created_before);
      }

      // Validate sort column
      const validSortColumns = ['due_date', 'created_at', 'title', 'priority', 'category', 'completed'];
      const sortColumn = validSortColumns.includes(sort) ? sort : 'created_at';
      const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      // Add relevance scoring for search results
      let selectClause = '*';
      if (search && search.trim()) {
        selectClause = `*,
          CASE
            WHEN title LIKE ? THEN 2
            WHEN description LIKE ? THEN 1
            ELSE 0
          END as relevance_score`;
        // Add search term for relevance scoring
        const searchForRelevance = `%${search.trim()}%`;
        params.splice(1, 0, searchForRelevance, searchForRelevance);
      }

      const query = `
        SELECT ${selectClause} FROM tasks
        ${whereClause}
        ORDER BY ${search ? 'relevance_score DESC, ' : ''}${sortColumn} ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      params.push(parseInt(limit), parseInt(offset));

      const tasks = await db.all(query, params);

      // Get total count for pagination (without relevance scoring)
      const countQuery = `SELECT COUNT(*) as total FROM tasks ${whereClause}`;
      const countParams = search ? params.slice(2, -2) : params.slice(0, -2); // Remove relevance params and pagination
      const countResult = await db.get(countQuery, countParams);

      res.json({
        success: true,
        data: {
          tasks: tasks.map(task => this.formatTask(task)),
          pagination: {
            total: countResult.total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
            totalPages: Math.ceil(countResult.total / parseInt(limit))
          },
          filters: {
            search: search || null,
            completed: completed || null,
            priority: priority || null,
            category: category || null,
            due_after: due_after || null,
            due_before: due_before || null,
            created_after: created_after || null,
            created_before: created_before || null
          }
        }
      });
    } catch (error) {
      console.error('Get tasks error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve tasks',
        error: error.message
      });
    }
  }

  /**
   * Search suggestions endpoint
   * GET /api/tasks/search/suggestions
   */
  async getSearchSuggestions(req, res) {
    try {
      await ensureDbConnection();
      const userId = req.user.userId;
      const { q } = req.query;

      if (!q || q.trim().length < 2) {
        return res.json({
          success: true,
          data: { suggestions: [] }
        });
      }

      const searchTerm = `%${q.trim()}%`;

      // Get suggestions from task titles and frequent search terms
      const titleSuggestions = await db.all(
        `SELECT DISTINCT title as suggestion, 'title' as type
         FROM tasks
         WHERE user_id = ? AND title LIKE ?
         ORDER BY created_at DESC
         LIMIT 5`,
        [userId, searchTerm]
      );

      const historySuggestions = await db.all(
        `SELECT DISTINCT search_term as suggestion, 'history' as type
         FROM search_history
         WHERE user_id = ? AND search_term LIKE ?
         ORDER BY last_searched DESC
         LIMIT 3`,
        [userId, searchTerm]
      );

      const suggestions = [...titleSuggestions, ...historySuggestions]
        .slice(0, 8)
        .map(item => ({
          text: item.suggestion,
          type: item.type
        }));

      res.json({
        success: true,
        data: { suggestions }
      });
    } catch (error) {
      console.error('Get search suggestions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get search suggestions',
        error: error.message
      });
    }
  }

  /**
   * Get search history
   * GET /api/tasks/search/history
   */
  async getSearchHistory(req, res) {
    try {
      await ensureDbConnection();
      const userId = req.user.userId;
      const { limit = 10 } = req.query;

      const history = await db.all(
        `SELECT search_term, search_count, last_searched
         FROM search_history
         WHERE user_id = ?
         ORDER BY last_searched DESC
         LIMIT ?`,
        [userId, parseInt(limit)]
      );

      res.json({
        success: true,
        data: {
          history: history.map(item => ({
            term: item.search_term,
            count: item.search_count,
            lastSearched: item.last_searched
          }))
        }
      });
    } catch (error) {
      console.error('Get search history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get search history',
        error: error.message
      });
    }
  }

  /**
   * Clear search history
   * DELETE /api/tasks/search/history
   */
  async clearSearchHistory(req, res) {
    try {
      await ensureDbConnection();
      const userId = req.user.userId;

      await db.run(
        'DELETE FROM search_history WHERE user_id = ?',
        [userId]
      );

      res.json({
        success: true,
        message: 'Search history cleared successfully'
      });
    } catch (error) {
      console.error('Clear search history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear search history',
        error: error.message
      });
    }
  }

  /**
   * Track search history (internal helper)
   */
  async trackSearchHistory(userId, searchTerm) {
    try {
      await ensureDbConnection();

      // Check if search term already exists
      const existing = await db.get(
        'SELECT id, search_count FROM search_history WHERE user_id = ? AND search_term = ?',
        [userId, searchTerm]
      );

      if (existing) {
        // Update existing record
        await db.run(
          `UPDATE search_history
           SET search_count = search_count + 1, last_searched = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [existing.id]
        );
      } else {
        // Insert new record
        await db.run(
          `INSERT INTO search_history (user_id, search_term, search_count, last_searched)
           VALUES (?, ?, 1, CURRENT_TIMESTAMP)`,
          [userId, searchTerm]
        );
      }

      // Clean up old search history (keep only 50 most recent per user)
      await db.run(
        `DELETE FROM search_history
         WHERE user_id = ? AND id NOT IN (
           SELECT id FROM search_history
           WHERE user_id = ?
           ORDER BY last_searched DESC
           LIMIT 50
         )`,
        [userId, userId]
      );
    } catch (error) {
      console.error('Track search history error:', error);
      // Don't throw - this is non-critical functionality
    }
  }

  /**
   * Get a specific task by ID
   * GET /api/tasks/:id
   */
  async getTask(req, res) {
    try {
      await ensureDbConnection();
      const taskId = req.params.id;
      const userId = req.user.userId;

      const task = await db.get(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      res.json({
        success: true,
        data: {
          task: this.formatTask(task)
        }
      });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve task',
        error: error.message
      });
    }
  }

  /**
   * Update a task
   * PUT /api/tasks/:id
   */
  async updateTask(req, res) {
    try {
      await ensureDbConnection();
      const taskId = req.params.id;
      const userId = req.user.userId;
      const { title, description, completed, priority, dueDate } = req.body;

      // First check if task exists and belongs to user
      const existingTask = await db.get(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );

      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      // Build update query dynamically based on provided fields
      const updates = [];
      const params = [];

      if (title !== undefined) {
        updates.push('title = ?');
        params.push(title);
      }
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      if (completed !== undefined) {
        updates.push('completed = ?');
        params.push(completed ? 1 : 0);
      }
      if (priority !== undefined) {
        updates.push('priority = ?');
        params.push(priority);
      }
      if (req.body.category !== undefined) {
        updates.push('category = ?');
        params.push(req.body.category);
      }
      if (dueDate !== undefined) {
        updates.push('due_date = ?');
        params.push(dueDate);
      }

      if (updates.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No fields provided to update'
        });
      }

      // Add updated_at timestamp
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(taskId, userId);

      const updateQuery = `
        UPDATE tasks
        SET ${updates.join(', ')}
        WHERE id = ? AND user_id = ?
      `;

      await db.run(updateQuery, params);

      // Fetch the updated task
      const updatedTask = await db.get(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );

      res.json({
        success: true,
        message: 'Task updated successfully',
        data: {
          task: this.formatTask(updatedTask)
        }
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update task',
        error: error.message
      });
    }
  }

  /**
   * Delete a task
   * DELETE /api/tasks/:id
   */
  async deleteTask(req, res) {
    try {
      await ensureDbConnection();
      const taskId = req.params.id;
      const userId = req.user.userId;

      // First check if task exists and belongs to user
      const existingTask = await db.get(
        'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );

      if (!existingTask) {
        return res.status(404).json({
          success: false,
          message: 'Task not found'
        });
      }

      // Delete the task (hard delete)
      await db.run(
        'DELETE FROM tasks WHERE id = ? AND user_id = ?',
        [taskId, userId]
      );

      res.json({
        success: true,
        message: 'Task deleted successfully'
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete task',
        error: error.message
      });
    }
  }

  /**
   * Bulk operations for tasks
   * POST /api/tasks/bulk
   */
  async bulkOperations(req, res) {
    try {
      await ensureDbConnection();
      const userId = req.user.userId;
      const { operation, taskIds, updates } = req.body;

      if (!operation || !taskIds || !Array.isArray(taskIds)) {
        return res.status(400).json({
          success: false,
          message: 'Operation and taskIds array are required'
        });
      }

      let result = {};

      switch (operation) {
        case 'delete':
          result = await this.bulkDelete(userId, taskIds);
          break;
        case 'update':
          if (!updates) {
            return res.status(400).json({
              success: false,
              message: 'Updates object is required for bulk update'
            });
          }
          result = await this.bulkUpdate(userId, taskIds, updates);
          break;
        case 'complete':
          result = await this.bulkUpdate(userId, taskIds, { completed: true });
          break;
        case 'incomplete':
          result = await this.bulkUpdate(userId, taskIds, { completed: false });
          break;
        default:
          return res.status(400).json({
            success: false,
            message: 'Invalid operation. Supported: delete, update, complete, incomplete'
          });
      }

      res.json({
        success: true,
        message: `Bulk ${operation} completed`,
        data: result
      });
    } catch (error) {
      console.error('Bulk operations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to perform bulk operation',
        error: error.message
      });
    }
  }

  /**
   * Bulk delete tasks
   */
  async bulkDelete(userId, taskIds) {
    const placeholders = taskIds.map(() => '?').join(',');
    const query = `DELETE FROM tasks WHERE id IN (${placeholders}) AND user_id = ?`;
    const params = [...taskIds, userId];

    const result = await db.run(query, params);
    return { deletedCount: result.changes };
  }

  /**
   * Bulk update tasks
   */
  async bulkUpdate(userId, taskIds, updates) {
    const updateFields = [];
    const params = [];

    if (updates.completed !== undefined) {
      updateFields.push('completed = ?');
      params.push(updates.completed ? 1 : 0);
    }
    if (updates.priority !== undefined) {
      updateFields.push('priority = ?');
      params.push(updates.priority);
    }
    if (updates.category !== undefined) {
      updateFields.push('category = ?');
      params.push(updates.category);
    }

    if (updateFields.length === 0) {
      throw new Error('No valid update fields provided');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');

    const placeholders = taskIds.map(() => '?').join(',');
    const query = `
      UPDATE tasks
      SET ${updateFields.join(', ')}
      WHERE id IN (${placeholders}) AND user_id = ?
    `;

    params.push(...taskIds, userId);
    const result = await db.run(query, params);

    return { updatedCount: result.changes };
  }

  /**
   * Get task statistics with filtering support
   * GET /api/tasks/stats
   */
  async getStats(req, res) {
    try {
      await ensureDbConnection();
      const userId = req.user.userId;
      const { priority, category } = req.query;

      let whereClause = 'WHERE user_id = ?';
      const params = [userId];

      if (priority) {
        whereClause += ' AND priority = ?';
        params.push(priority);
      }

      if (category) {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      // Get basic counts
      const totalQuery = `SELECT COUNT(*) as total FROM tasks ${whereClause}`;
      const completedQuery = `SELECT COUNT(*) as completed FROM tasks ${whereClause} AND completed = 1`;
      const pendingQuery = `SELECT COUNT(*) as pending FROM tasks ${whereClause} AND completed = 0`;

      // Get overdue tasks
      const overdueQuery = `
        SELECT COUNT(*) as overdue FROM tasks
        ${whereClause} AND completed = 0 AND due_date < DATE('now')
      `;

      // Get priority breakdown
      const priorityQuery = `
        SELECT priority, COUNT(*) as count
        FROM tasks ${whereClause}
        GROUP BY priority
      `;

      // Get category breakdown
      const categoryQuery = `
        SELECT category, COUNT(*) as count
        FROM tasks ${whereClause}
        GROUP BY category
      `;

      const [total, completed, pending, overdue, priorityBreakdown, categoryBreakdown] = await Promise.all([
        db.get(totalQuery, params),
        db.get(completedQuery, params),
        db.get(pendingQuery, params),
        db.get(overdueQuery, params),
        db.all(priorityQuery, params),
        db.all(categoryQuery, params)
      ]);

      res.json({
        success: true,
        data: {
          total: total.total,
          completed: completed.completed,
          pending: pending.pending,
          overdue: overdue.overdue,
          completionRate: total.total > 0 ? Math.round((completed.completed / total.total) * 100) : 0,
          priorityBreakdown: priorityBreakdown.reduce((acc, item) => {
            acc[item.priority] = item.count;
            return acc;
          }, {}),
          categoryBreakdown: categoryBreakdown.reduce((acc, item) => {
            acc[item.category] = item.count;
            return acc;
          }, {})
        }
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get task statistics',
        error: error.message
      });
    }
  }

  /**
   * Format task object for API response
   */
  formatTask(task) {
    if (!task) return null;

    const formatted = {
      id: task.id,
      title: task.title,
      description: task.description,
      completed: Boolean(task.completed),
      priority: task.priority,
      category: task.category,
      dueDate: task.due_date,
      createdAt: task.created_at,
      updatedAt: task.updated_at
    };

    // Include relevance score if present (for search results)
    if (task.relevance_score !== undefined) {
      formatted.relevanceScore = task.relevance_score;
    }

    return formatted;
  }
}

module.exports = TaskController;