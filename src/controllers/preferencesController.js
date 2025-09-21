const Database = require('../models/database');

class PreferencesController {
  constructor() {
    this.db = new Database();
  }

  async initialize() {
    await this.db.connect();
  }

  // Get user notification preferences
  async getPreferences(req, res) {
    try {
      const userId = req.user.userId;

      let preferences = await this.db.get(`
        SELECT * FROM user_preferences WHERE user_id = ?
      `, [userId]);

      // Create default preferences if none exist
      if (!preferences) {
        await this.db.run(`
          INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
          VALUES (?, 1, 1, 24, 'daily')
        `, [userId]);

        preferences = await this.db.get(`
          SELECT * FROM user_preferences WHERE user_id = ?
        `, [userId]);
      }

      res.json({
        success: true,
        data: {
          email_enabled: Boolean(preferences.email_enabled),
          browser_enabled: Boolean(preferences.browser_enabled),
          due_date_hours: preferences.due_date_hours,
          digest_frequency: preferences.digest_frequency
        }
      });
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences'
      });
    }
  }

  // Update user notification preferences
  async updatePreferences(req, res) {
    try {
      const userId = req.user.userId;
      const {
        email_enabled,
        browser_enabled,
        due_date_hours,
        digest_frequency
      } = req.body;

      // Filter out undefined values for partial updates
      const updateFields = {};
      if (email_enabled !== undefined) updateFields.email_enabled = email_enabled;
      if (browser_enabled !== undefined) updateFields.browser_enabled = browser_enabled;
      if (due_date_hours !== undefined) updateFields.due_date_hours = due_date_hours;
      if (digest_frequency !== undefined) updateFields.digest_frequency = digest_frequency;

      // Validate only the provided fields
      const validationErrors = this.validatePreferences(updateFields);

      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid preferences data',
          errors: validationErrors
        });
      }

      // Check if preferences exist
      const existingPreferences = await this.db.get(`
        SELECT * FROM user_preferences WHERE user_id = ?
      `, [userId]);

      if (existingPreferences) {
        // Build dynamic UPDATE query for existing preferences
        const setClauses = [];
        const values = [];

        if (updateFields.email_enabled !== undefined) {
          setClauses.push('email_enabled = ?');
          values.push(updateFields.email_enabled ? 1 : 0);
        }
        if (updateFields.browser_enabled !== undefined) {
          setClauses.push('browser_enabled = ?');
          values.push(updateFields.browser_enabled ? 1 : 0);
        }
        if (updateFields.due_date_hours !== undefined) {
          setClauses.push('due_date_hours = ?');
          values.push(updateFields.due_date_hours);
        }
        if (updateFields.digest_frequency !== undefined) {
          setClauses.push('digest_frequency = ?');
          values.push(updateFields.digest_frequency);
        }

        if (setClauses.length > 0) {
          setClauses.push('updated_at = CURRENT_TIMESTAMP');
          values.push(userId);

          const query = `
            UPDATE user_preferences
            SET ${setClauses.join(', ')}
            WHERE user_id = ?
          `;

          await this.db.run(query, values);
        }
      } else {
        // Create new preferences with defaults for missing fields
        const defaultPrefs = {
          email_enabled: true,
          browser_enabled: true,
          due_date_hours: 24,
          digest_frequency: 'daily'
        };

        // Override defaults with provided values
        const finalPrefs = { ...defaultPrefs, ...updateFields };

        await this.db.run(`
          INSERT INTO user_preferences (user_id, email_enabled, browser_enabled, due_date_hours, digest_frequency)
          VALUES (?, ?, ?, ?, ?)
        `, [
          userId,
          finalPrefs.email_enabled ? 1 : 0,
          finalPrefs.browser_enabled ? 1 : 0,
          finalPrefs.due_date_hours,
          finalPrefs.digest_frequency
        ]);
      }

      res.json({
        success: true,
        message: 'Notification preferences updated successfully'
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences'
      });
    }
  }

  validatePreferences(preferences) {
    const errors = [];

    // Validate email_enabled
    if (preferences.email_enabled !== undefined && typeof preferences.email_enabled !== 'boolean') {
      errors.push('email_enabled must be a boolean');
    }

    // Validate browser_enabled
    if (preferences.browser_enabled !== undefined && typeof preferences.browser_enabled !== 'boolean') {
      errors.push('browser_enabled must be a boolean');
    }

    // Validate due_date_hours
    if (preferences.due_date_hours !== undefined) {
      if (!Number.isInteger(preferences.due_date_hours) || preferences.due_date_hours < 1 || preferences.due_date_hours > 168) {
        errors.push('due_date_hours must be an integer between 1 and 168 (7 days)');
      }
    }

    // Validate digest_frequency
    if (preferences.digest_frequency !== undefined) {
      const validFrequencies = ['daily', 'weekly', 'never'];
      if (!validFrequencies.includes(preferences.digest_frequency)) {
        errors.push('digest_frequency must be one of: daily, weekly, never');
      }
    }

    return errors;
  }
}

module.exports = new PreferencesController();
