---
created: 2025-09-20T20:15:27Z
last_updated: 2025-09-20T20:15:27Z
version: 1.0
author: Claude Code PM System
---

# Project Style Guide

## Coding Standards & Conventions

### General Principles
**Clarity Over Cleverness**: Code should be immediately understandable to team members
**Consistency First**: Follow established patterns throughout the codebase
**Performance Awareness**: Write efficient code, but prioritize readability unless performance is critical
**Security Mindset**: Consider security implications in every coding decision

### Language-Specific Guidelines

#### JavaScript/Node.js Standards
**Naming Conventions**:
- **Variables & Functions**: camelCase (`getUserData`, `taskList`, `isComplete`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_TASKS_PER_PAGE`)
- **Classes**: PascalCase (`TaskManager`, `NotificationService`)
- **Files**: kebab-case (`task-service.js`, `user-auth.js`)

**Code Structure**:
```javascript
// Prefer explicit imports
import { createTask, updateTask } from './task-service.js';

// Use descriptive function names
function validateTaskInput(taskData) {
  // Implementation
}

// Prefer early returns for validation
function processTask(task) {
  if (!task.title) {
    return { error: 'Title is required' };
  }

  if (!task.category) {
    return { error: 'Category is required' };
  }

  // Main logic here
  return processValidTask(task);
}
```

#### CSS/SCSS Standards
**Naming Convention**: BEM (Block Element Modifier)
```css
/* Block */
.task-list {}

/* Element */
.task-list__item {}
.task-list__title {}

/* Modifier */
.task-list__item--completed {}
.task-list__item--high-priority {}
```

**Organization Pattern**:
```scss
// 1. Variables and mixins
$primary-color: #2563eb;
$border-radius: 0.375rem;

// 2. Base styles
.task-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  // 3. Element styles
  &__item {
    padding: 1rem;
    border-radius: $border-radius;
    border: 1px solid #e5e7eb;

    // 4. Modifier styles
    &--completed {
      opacity: 0.6;
      text-decoration: line-through;
    }
  }
}
```

#### SQL/Database Standards
**Naming Conventions**:
- **Tables**: plural, snake_case (`tasks`, `user_preferences`)
- **Columns**: snake_case (`created_at`, `due_date`, `priority_level`)
- **Indexes**: descriptive with prefix (`idx_tasks_due_date`, `idx_users_email`)

**Query Structure**:
```sql
-- Use consistent formatting and aliasing
SELECT
  t.id,
  t.title,
  t.due_date,
  c.name AS category_name
FROM tasks t
INNER JOIN categories c ON t.category_id = c.id
WHERE t.user_id = $1
  AND t.status = 'pending'
ORDER BY t.due_date ASC, t.priority_level DESC;
```

## File Structure & Organization

### Directory Naming
**Pattern**: kebab-case for all directories
```
src/
├── api-routes/          # API endpoint handlers
├── data-models/         # Database models and schemas
├── ui-components/       # Frontend components
├── business-logic/      # Core business logic
├── external-services/   # Third-party integrations
└── test-utilities/      # Testing helpers and fixtures
```

### File Naming Patterns
**JavaScript Files**:
- **Services**: `{domain}-service.js` (e.g., `task-service.js`, `auth-service.js`)
- **Models**: `{entity}-model.js` (e.g., `task-model.js`, `user-model.js`)
- **Components**: `{component-name}.js` (e.g., `task-list.js`, `priority-selector.js`)
- **Utilities**: `{purpose}-utils.js` (e.g., `date-utils.js`, `validation-utils.js`)

**Test Files**:
- **Unit Tests**: `{filename}.test.js` (e.g., `task-service.test.js`)
- **Integration Tests**: `{feature}.integration.test.js`
- **E2E Tests**: `{workflow}.e2e.test.js`

### Module Organization
**Import Order**:
```javascript
// 1. External dependencies
import express from 'express';
import bcrypt from 'bcrypt';

// 2. Internal utilities and services
import { validateInput } from '../utilities/validation-utils.js';
import { TaskService } from '../services/task-service.js';

// 3. Local files
import { TaskModel } from './task-model.js';
```

## Documentation Standards

### Code Comments
**When to Comment**:
- **Business Logic**: Explain "why" not "what"
- **Complex Algorithms**: Describe approach and reasoning
- **API Endpoints**: Document expected inputs and outputs
- **Configuration**: Explain non-obvious settings

**Comment Style**:
```javascript
/**
 * Calculate task priority score based on due date and user-assigned priority
 *
 * Priority algorithm:
 * - Overdue tasks get maximum urgency boost
 * - High priority tasks get 2x multiplier
 * - Medium priority tasks get 1.5x multiplier
 * - Low priority tasks get base score
 *
 * @param {Object} task - Task object with dueDate and priority
 * @returns {number} Priority score (0-100)
 */
function calculatePriorityScore(task) {
  // Implementation
}

// Single-line comments for inline explanations
const maxRetries = 3; // Rate limiting prevents more than 3 attempts
```

### API Documentation
**Endpoint Documentation Pattern**:
```javascript
/**
 * GET /api/tasks
 *
 * Retrieve user's tasks with optional filtering
 *
 * Query Parameters:
 * - category (string, optional): Filter by category
 * - priority (string, optional): Filter by priority level
 * - status (string, optional): Filter by completion status
 * - limit (number, optional): Max results (default: 50)
 *
 * Returns:
 * - 200: Array of task objects
 * - 400: Invalid query parameters
 * - 401: Authentication required
 */
```

### README Documentation
**Project Documentation Structure**:
```markdown
# Project Title

## Quick Start
[5-minute setup instructions]

## Architecture Overview
[High-level system design]

## Development Guide
[Local development setup]

## API Reference
[Key endpoints and usage]

## Deployment
[Production deployment steps]
```

## Error Handling Patterns

### Error Response Format
**Consistent Error Structure**:
```javascript
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Task title is required",
    "details": {
      "field": "title",
      "constraint": "required"
    },
    "timestamp": "2025-09-20T20:15:27Z"
  }
}
```

### Error Handling Strategy
**Validation Errors**:
```javascript
function validateTaskInput(input) {
  const errors = [];

  if (!input.title?.trim()) {
    errors.push({
      field: 'title',
      message: 'Title is required',
      code: 'REQUIRED_FIELD'
    });
  }

  if (input.title?.length > 200) {
    errors.push({
      field: 'title',
      message: 'Title must be 200 characters or less',
      code: 'MAX_LENGTH_EXCEEDED'
    });
  }

  return errors.length > 0 ? { errors } : null;
}
```

## Testing Conventions

### Test Organization
**Test File Structure**:
```javascript
describe('TaskService', () => {
  describe('createTask', () => {
    it('should create task with valid input', async () => {
      // Arrange
      const taskData = { title: 'Test Task', category: 'work' };

      // Act
      const result = await TaskService.createTask(taskData);

      // Assert
      expect(result.id).toBeDefined();
      expect(result.title).toBe('Test Task');
    });

    it('should reject task without title', async () => {
      // Arrange
      const taskData = { category: 'work' };

      // Act & Assert
      await expect(TaskService.createTask(taskData))
        .rejects.toThrow('Title is required');
    });
  });
});
```

### Test Naming
**Test Description Pattern**: "should [expected behavior] when [condition]"
```javascript
it('should return completed tasks when status filter is completed', () => {});
it('should calculate correct priority score when task is overdue', () => {});
it('should send email notification when task deadline approaches', () => {});
```

## Version Control Practices

### Commit Message Format
**Conventional Commits Pattern**:
```
type(scope): description

feat(auth): add JWT token refresh functionality
fix(tasks): resolve priority calculation edge case
docs(api): update endpoint documentation
test(tasks): add integration tests for bulk operations
refactor(db): optimize task query performance
```

### Branch Naming
**Branch Naming Pattern**:
```
type/short-description
feature/task-priority-system
bugfix/authentication-redirect
hotfix/security-vulnerability
docs/api-documentation-update
```

### Pull Request Guidelines
**PR Description Template**:
```markdown
## Summary
Brief description of changes

## Changes Made
- Specific change 1
- Specific change 2

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing completed

## Screenshots (if UI changes)
[Include relevant screenshots]
```

## Performance & Security Guidelines

### Performance Best Practices
**Database Queries**:
- Always use prepared statements/parameterized queries
- Index columns used in WHERE clauses and JOINs
- Limit result sets with pagination
- Avoid N+1 query problems

**Frontend Performance**:
- Minimize DOM manipulations
- Use event delegation for dynamic content
- Implement lazy loading for non-critical features
- Optimize image sizes and formats

### Security Practices
**Input Validation**:
- Validate and sanitize all user inputs
- Use whitelist validation over blacklist
- Implement proper error handling without information leakage

**Authentication & Authorization**:
- Use secure session management
- Implement proper JWT token handling
- Follow principle of least privilege for API access