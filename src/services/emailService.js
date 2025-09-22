const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const config = require('../config');

class EmailService {
  constructor() {
    this.transporter = null;
    this.templates = {};
    this.initializeTransporter();
    this.loadTemplates();
  }

  initializeTransporter() {
    // Configuration for email transporter
    const emailConfig = {
      host: process.env.SMTP_HOST || 'localhost',
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    };

    // For development, use ethereal email if no SMTP config provided
    if (!process.env.SMTP_HOST && process.env.NODE_ENV !== 'production') {
      console.log('No SMTP configuration found, using test account for development');
      this.createTestAccount();
      return;
    }

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verify connection configuration
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('Email service configuration error:', error);
      } else {
        console.log('Email service is ready to send messages');
      }
    });
  }

  async createTestAccount() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('Test email account created:', testAccount.user);
    } catch (error) {
      console.error('Failed to create test email account:', error);
    }
  }

  loadTemplates() {
    const templatesDir = path.join(__dirname, '../templates/email');

    // Create templates directory if it doesn't exist
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
      this.createDefaultTemplates(templatesDir);
    }

    try {
      // Load email templates
      const templateFiles = ['due_reminder.hbs', 'overdue_alert.hbs', 'daily_digest.hbs', 'welcome.hbs'];

      templateFiles.forEach(file => {
        const templatePath = path.join(templatesDir, file);
        if (fs.existsSync(templatePath)) {
          const templateContent = fs.readFileSync(templatePath, 'utf8');
          const templateName = path.basename(file, '.hbs');
          this.templates[templateName] = handlebars.compile(templateContent);
        }
      });

      console.log('Email templates loaded successfully');
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  }

  createDefaultTemplates(templatesDir) {
    const templates = {
      'due_reminder.hbs': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Task Due Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .task { border-left: 4px solid #007bff; padding-left: 15px; margin: 15px 0; }
        .due-date { color: #dc3545; font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Task Due Reminder</h1>
        </div>
        <div class="content">
            <p>Hello {{user.first_name}},</p>
            <p>This is a friendly reminder that you have a task due soon:</p>

            <div class="task">
                <h3>{{task.title}}</h3>
                <p>{{task.description}}</p>
                <p class="due-date">Due: {{task.due_date}}</p>
                <p>Priority: {{task.priority_text}}</p>
            </div>

            <p>Don't forget to complete this task on time!</p>
        </div>
        <div class="footer">
            <p>This is an automated reminder from your Todo List application.</p>
        </div>
    </div>
</body>
</html>`,

      'overdue_alert.hbs': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Overdue Task Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .task { border-left: 4px solid #dc3545; padding-left: 15px; margin: 15px 0; }
        .overdue { color: #dc3545; font-weight: bold; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚠️ Overdue Task Alert</h1>
        </div>
        <div class="content">
            <p>Hello {{user.first_name}},</p>
            <p>You have an overdue task that needs your attention:</p>

            <div class="task">
                <h3>{{task.title}}</h3>
                <p>{{task.description}}</p>
                <p class="overdue">Was due: {{task.due_date}}</p>
                <p>Priority: {{task.priority_text}}</p>
            </div>

            <p>Please complete this task as soon as possible.</p>
        </div>
        <div class="footer">
            <p>This is an automated alert from your Todo List application.</p>
        </div>
    </div>
</body>
</html>`,

      'daily_digest.hbs': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Daily Task Digest</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .section { margin: 20px 0; }
        .task-list { list-style: none; padding: 0; }
        .task-item { border-left: 4px solid #007bff; padding: 10px; margin: 10px 0; background-color: #f8f9fa; }
        .overdue-item { border-left-color: #dc3545; }
        .due-soon-item { border-left-color: #ffc107; }
        .stats { display: flex; justify-content: space-around; background-color: #f8f9fa; padding: 15px; }
        .stat { text-align: center; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📊 Daily Task Digest</h1>
            <p>{{date}}</p>
        </div>
        <div class="content">
            <p>Hello {{user.first_name}},</p>
            <p>Here's your daily task summary:</p>

            <div class="stats">
                <div class="stat">
                    <h3>{{stats.total}}</h3>
                    <p>Total Tasks</p>
                </div>
                <div class="stat">
                    <h3>{{stats.completed}}</h3>
                    <p>Completed</p>
                </div>
                <div class="stat">
                    <h3>{{stats.overdue}}</h3>
                    <p>Overdue</p>
                </div>
                <div class="stat">
                    <h3>{{stats.due_soon}}</h3>
                    <p>Due Soon</p>
                </div>
            </div>

            {{#if overdue_tasks}}
            <div class="section">
                <h3>⚠️ Overdue Tasks</h3>
                <ul class="task-list">
                    {{#each overdue_tasks}}
                    <li class="task-item overdue-item">
                        <strong>{{title}}</strong><br>
                        Due: {{due_date}}<br>
                        Priority: {{priority_text}}
                    </li>
                    {{/each}}
                </ul>
            </div>
            {{/if}}

            {{#if due_soon_tasks}}
            <div class="section">
                <h3>📅 Due Soon</h3>
                <ul class="task-list">
                    {{#each due_soon_tasks}}
                    <li class="task-item due-soon-item">
                        <strong>{{title}}</strong><br>
                        Due: {{due_date}}<br>
                        Priority: {{priority_text}}
                    </li>
                    {{/each}}
                </ul>
            </div>
            {{/if}}

            <p>Keep up the great work!</p>
        </div>
        <div class="footer">
            <p>This is your daily digest from your Todo List application.</p>
        </div>
    </div>
</body>
</html>`,

      'welcome.hbs': `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Welcome to Todo List</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .features { background-color: #f8f9fa; padding: 15px; margin: 15px 0; }
        .footer { background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Welcome to Todo List!</h1>
        </div>
        <div class="content">
            <p>Hello {{user.first_name}},</p>
            <p>Welcome to your new Todo List application! We're excited to help you stay organized and productive.</p>

            <div class="features">
                <h3>What you can do:</h3>
                <ul>
                    <li>Create and manage tasks with due dates</li>
                    <li>Set priorities for your tasks</li>
                    <li>Get email reminders for upcoming tasks</li>
                    <li>Receive daily digest emails</li>
                    <li>Access your tasks from anywhere</li>
                </ul>
            </div>

            <p>You can customize your notification preferences anytime in your account settings.</p>
            <p>Happy organizing!</p>
        </div>
        <div class="footer">
            <p>Thank you for joining Todo List application.</p>
        </div>
    </div>
</body>
</html>`
    };

    Object.entries(templates).forEach(([filename, content]) => {
      fs.writeFileSync(path.join(templatesDir, filename), content.trim());
    });

    console.log('Default email templates created');
  }

  async sendEmail(to, subject, templateName, data = {}) {
    try {
      if (!this.transporter) {
        throw new Error('Email transporter not configured');
      }

      if (!this.templates[templateName]) {
        throw new Error(`Template '${templateName}' not found`);
      }

      const html = this.templates[templateName](data);

      const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@todolist.app',
        to,
        subject,
        html
      };

      const info = await this.transporter.sendMail(mailOptions);

      // For test accounts, log the preview URL
      if (process.env.NODE_ENV !== 'production' && nodemailer.getTestMessageUrl(info)) {
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
      }

      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error('Email sending error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendDueReminder(user, task) {
    const data = {
      user,
      task: {
        ...task,
        priority_text: this.getPriorityText(task.priority),
        due_date: new Date(task.due_date).toLocaleDateString()
      }
    };

    return this.sendEmail(
      user.email,
      `Task Due Soon: ${task.title}`,
      'due_reminder',
      data
    );
  }

  async sendOverdueAlert(user, task) {
    const data = {
      user,
      task: {
        ...task,
        priority_text: this.getPriorityText(task.priority),
        due_date: new Date(task.due_date).toLocaleDateString()
      }
    };

    return this.sendEmail(
      user.email,
      `Overdue Task Alert: ${task.title}`,
      'overdue_alert',
      data
    );
  }

  async sendDailyDigest(user, stats, overdueTasks = [], dueSoonTasks = []) {
    const data = {
      user,
      date: new Date().toLocaleDateString(),
      stats,
      overdue_tasks: overdueTasks.map(task => ({
        ...task,
        priority_text: this.getPriorityText(task.priority),
        due_date: new Date(task.due_date).toLocaleDateString()
      })),
      due_soon_tasks: dueSoonTasks.map(task => ({
        ...task,
        priority_text: this.getPriorityText(task.priority),
        due_date: new Date(task.due_date).toLocaleDateString()
      }))
    };

    return this.sendEmail(
      user.email,
      'Your Daily Task Digest',
      'daily_digest',
      data
    );
  }

  async sendWelcomeEmail(user) {
    const data = { user };

    return this.sendEmail(
      user.email,
      'Welcome to Todo List!',
      'welcome',
      data
    );
  }

  getPriorityText(priority) {
    const priorities = {
      1: 'Low',
      2: 'Medium',
      3: 'High',
      4: 'Urgent'
    };
    return priorities[priority] || 'Medium';
  }
}

module.exports = new EmailService();