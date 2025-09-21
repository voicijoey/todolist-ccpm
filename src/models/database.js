const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const config = require('../config');

class Database {
  constructor() {
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      // Ensure data directory exists
      const dbDir = path.dirname(config.database.path);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(config.database.path, (err) => {
        if (err) {
          console.error('Database connection error:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          // Enable foreign key constraints
          this.db.run('PRAGMA foreign_keys = ON');
          resolve();
        }
      });
    });
  }

  async disconnect() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database connection closed');
            this.db = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async migrate() {
    console.log('Running database migrations...');

    // Create users table
    await this.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tasks table
    await this.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT 0,
        priority INTEGER DEFAULT 1,
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Run priority and category migration
    await this.migratePriorityAndCategory();

    // Create user_preferences table for notification settings
    await this.run(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        email_enabled BOOLEAN DEFAULT 1,
        browser_enabled BOOLEAN DEFAULT 1,
        due_date_hours INTEGER DEFAULT 24,
        digest_frequency TEXT DEFAULT 'daily',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `);

    // Create notifications table for notification logging
    await this.run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER,
        type TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        sent_at DATETIME,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    await this.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks (completed)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks (created_at)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks (category)');
    await this.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences (user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications (task_id)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type)');
    await this.run('CREATE INDEX IF NOT EXISTS idx_notifications_sent_at ON notifications (sent_at)');

    console.log('Database migrations completed successfully');
  }

  async migratePriorityAndCategory() {
    console.log('Running priority and category migration...');

    try {
      // Check if columns already exist with correct schema
      const tableInfo = await this.all("PRAGMA table_info(tasks)");
      const priorityCol = tableInfo.find(col => col.name === 'priority');
      const hasCategory = tableInfo.some(col => col.name === 'category');

      // Check if priority is already TEXT type (migrated) and category exists
      if (priorityCol && priorityCol.type.includes('TEXT') && hasCategory) {
        console.log('Priority and category columns already migrated');
        return;
      }

      // Start transaction for data migration
      await this.run('BEGIN TRANSACTION');

      // Create new table with updated schema
      await this.run(`
        CREATE TABLE tasks_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          completed BOOLEAN DEFAULT 0,
          priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
          category TEXT DEFAULT 'general' CHECK (category IN ('sales', 'operations', 'finance', 'general')),
          due_date DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
      `);

      // Migrate existing data with priority conversion
      await this.run(`
        INSERT INTO tasks_new (id, user_id, title, description, completed, priority, category, due_date, created_at, updated_at)
        SELECT
          id,
          user_id,
          title,
          description,
          completed,
          CASE
            WHEN priority >= 4 THEN 'high'
            WHEN priority >= 2 THEN 'medium'
            ELSE 'low'
          END as priority,
          'general' as category,
          due_date,
          created_at,
          updated_at
        FROM tasks
      `);

      // Drop old table and rename new one
      await this.run('DROP TABLE tasks');
      await this.run('ALTER TABLE tasks_new RENAME TO tasks');

      await this.run('COMMIT');
      console.log('Priority and category migration completed successfully');

    } catch (error) {
      await this.run('ROLLBACK');
      console.error('Migration failed, rolling back:', error.message);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.db) {
        return { status: 'unhealthy', message: 'Database not connected' };
      }
      await this.get('SELECT 1 as test');
      return { status: 'healthy', message: 'Database connection is working' };
    } catch (error) {
      return { status: 'unhealthy', message: error.message };
    }
  }
}

module.exports = Database;