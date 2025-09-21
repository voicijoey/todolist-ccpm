# Task Management API

## Overview
Complete CRUD operations for task management with user authentication, filtering, pagination, and bulk operations.

## Authentication
All endpoints require Bearer token authentication:
```
Authorization: Bearer <access_token>
```

## Endpoints

### 1. Create Task
**POST** `/api/tasks`

**Request Body:**
```json
{
  "title": "Task title (required, 1-200 chars)",
  "description": "Task description (optional, max 1000 chars)",
  "priority": 2,
  "dueDate": "2025-12-31T23:59:59.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "task": {
      "id": 1,
      "title": "Task title",
      "description": "Task description",
      "completed": false,
      "priority": 2,
      "dueDate": "2025-12-31T23:59:59.000Z",
      "createdAt": "2025-09-20T23:55:03Z",
      "updatedAt": "2025-09-20T23:55:03Z"
    }
  }
}
```

### 2. List Tasks
**GET** `/api/tasks`

**Query Parameters:**
- `completed`: Filter by completion status (true/false)
- `priority`: Filter by priority (1-5)
- `sort`: Sort field (due_date, created_at, title, priority, completed)
- `order`: Sort order (asc/desc)
- `limit`: Results per page (1-100, default: 50)
- `offset`: Results to skip (default: 0)

**Examples:**
```
GET /api/tasks?completed=false&priority=1&sort=due_date&order=asc&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": 1,
        "title": "Task title",
        "description": "Task description",
        "completed": false,
        "priority": 2,
        "dueDate": "2025-12-31T23:59:59.000Z",
        "createdAt": "2025-09-20T23:55:03Z",
        "updatedAt": "2025-09-20T23:55:03Z"
      }
    ],
    "pagination": {
      "total": 25,
      "limit": 20,
      "offset": 0,
      "page": 1,
      "totalPages": 2
    }
  }
}
```

### 3. Get Single Task
**GET** `/api/tasks/:id`

**Response:**
```json
{
  "success": true,
  "data": {
    "task": {
      "id": 1,
      "title": "Task title",
      "description": "Task description",
      "completed": false,
      "priority": 2,
      "dueDate": "2025-12-31T23:59:59.000Z",
      "createdAt": "2025-09-20T23:55:03Z",
      "updatedAt": "2025-09-20T23:55:03Z"
    }
  }
}
```

### 4. Update Task
**PUT** `/api/tasks/:id`

**Request Body (all fields optional):**
```json
{
  "title": "Updated title",
  "description": "Updated description",
  "completed": true,
  "priority": 3,
  "dueDate": "2025-12-31T23:59:59.000Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "task": {
      "id": 1,
      "title": "Updated title",
      "description": "Updated description",
      "completed": true,
      "priority": 3,
      "dueDate": "2025-12-31T23:59:59.000Z",
      "createdAt": "2025-09-20T23:55:03Z",
      "updatedAt": "2025-09-20T23:56:15Z"
    }
  }
}
```

### 5. Delete Task
**DELETE** `/api/tasks/:id`

**Response:**
```json
{
  "success": true,
  "message": "Task deleted successfully"
}
```

### 6. Bulk Operations
**POST** `/api/tasks/bulk`

**Request Body:**
```json
{
  "operation": "complete|incomplete|delete|update",
  "taskIds": [1, 2, 3],
  "updates": {
    "priority": 5,
    "completed": true
  }
}
```

**Operations:**
- `complete`: Mark tasks as completed
- `incomplete`: Mark tasks as not completed
- `delete`: Delete multiple tasks
- `update`: Update tasks with provided data (requires `updates` field)

**Response:**
```json
{
  "success": true,
  "message": "Bulk complete completed",
  "data": {
    "updatedCount": 3
  }
}
```

## Error Responses

### Validation Errors (400)
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "title",
      "message": "Title is required and must be between 1 and 200 characters",
      "value": ""
    }
  ]
}
```

### Authentication Errors (401)
```json
{
  "success": false,
  "message": "Access token is required"
}
```

### Not Found Errors (404)
```json
{
  "success": false,
  "message": "Task not found"
}
```

### Server Errors (500)
```json
{
  "success": false,
  "message": "Failed to create task",
  "error": "Database connection error"
}
```

## Data Model

### Task Object
```json
{
  "id": "integer (auto-generated)",
  "title": "string (1-200 chars, required)",
  "description": "string (max 1000 chars, optional)",
  "completed": "boolean (default: false)",
  "priority": "integer (1-5, default: 1)",
  "dueDate": "ISO 8601 date string (optional)",
  "createdAt": "ISO 8601 date string (auto-generated)",
  "updatedAt": "ISO 8601 date string (auto-updated)"
}
```

### Priority Levels
- `1`: Low
- `2`: Normal
- `3`: Medium
- `4`: High
- `5`: Critical

## Usage Examples

### Create a high-priority task
```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "title": "Fix critical bug",
    "description": "Security vulnerability needs immediate attention",
    "priority": 5,
    "dueDate": "2025-09-21T09:00:00Z"
  }'
```

### Get incomplete tasks sorted by priority
```bash
curl "http://localhost:3000/api/tasks?completed=false&sort=priority&order=desc" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Mark multiple tasks as completed
```bash
curl -X POST http://localhost:3000/api/tasks/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{
    "operation": "complete",
    "taskIds": [1, 2, 3]
  }'
```

### Update task completion status
```bash
curl -X PUT http://localhost:3000/api/tasks/1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -d '{"completed": true}'
```

## Security Features

- **User Isolation**: Users can only access their own tasks
- **Authentication Required**: All endpoints require valid JWT token
- **Input Validation**: Comprehensive validation on all user inputs
- **SQL Injection Protection**: Parameterized queries prevent SQL injection
- **Rate Limiting**: Authentication endpoints protected against brute force
- **CORS Protection**: Configured for secure cross-origin requests