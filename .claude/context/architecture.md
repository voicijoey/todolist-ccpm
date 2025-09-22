---
created: 2025-09-21T16:45:00Z
last_updated: 2025-09-21T16:45:00Z
version: 1.0
author: Claude Code PM System
---

# Application Architecture

## Implementation Overview

### **Technology Stack**
- **Backend**: Node.js + Express.js + SQLite
- **Frontend**: Vanilla JavaScript with ES6+ classes
- **Architecture**: Full-stack web application with REST API

## Frontend Architecture

### **Component Structure**
```
public/js/
├── app.js              # Main application controller & utilities
├── tasks.js            # Core task management (TaskManager class)
├── navigation.js       # View navigation (NavigationManager class)
├── api.js              # API communication layer
├── search-filter.js    # Search & filtering functionality
└── analytics.js        # Analytics dashboard (pending)
```

### **Class Architecture**

#### **Core Classes**
1. **App Class** (`app.js:6-85`)
   - **Purpose**: Application initialization and global event handling
   - **Responsibilities**: DOM ready handling, toast system, API health checks
   - **Pattern**: Singleton initialization on page load

2. **TaskManager Class** (`tasks.js:6-500`)
   - **Purpose**: Core task CRUD operations and UI management
   - **Key Features**:
     - Task creation, editing, deletion
     - Form validation and submission
     - Loading states and error handling
     - Defensive event binding prevention
   - **Pattern**: Singleton with event binding protection

3. **NavigationManager Class** (`navigation.js:6-254`)
   - **Purpose**: Single-page application navigation
   - **Key Features**:
     - View switching (tasks/analytics)
     - Filter management (all/pending/completed)
     - URL hash-based routing
     - TaskManager coordination
   - **Pattern**: Singleton with instance waiting logic

4. **ToastNotification Class** (`app.js:90-185`)
   - **Purpose**: User feedback system
   - **Features**: Success, error, warning, info messages
   - **Pattern**: Global singleton accessible via `window.toast`

### **Event Management Architecture**

#### **🔧 Defensive Event Binding Pattern**
**Problem Solved**: Multiple instances creating duplicate event listeners

**Implementation**:
```javascript
// TaskManager defensive binding (tasks.js:32-36)
bindEvents() {
    if (this.eventsBound) {
        console.log('Task events already bound, skipping duplicate binding');
        return;
    }
    // ... event binding code ...
    this.eventsBound = true;
}

// NavigationManager instance coordination (navigation.js:82-95)
if (!window.taskManager) {
    return new Promise((resolve) => {
        const checkTaskManager = () => {
            if (window.taskManager) {
                window.taskManager.setFilter(filter);
                window.taskManager.loadTasks().then(resolve);
            } else {
                setTimeout(checkTaskManager, 10);
            }
        };
        checkTaskManager();
    });
}
```

**Benefits**:
- ✅ Prevents duplicate form submissions
- ✅ Ensures single source of truth for event handling
- ✅ Maintains clean event listener management
- ✅ Eliminates race conditions between modules

### **State Management**

#### **Client-Side State**
- **TaskManager.tasks**: Array of current tasks
- **NavigationManager.currentView**: Active view (tasks/analytics)
- **NavigationManager.currentTaskFilter**: Active filter (all/pending/completed)
- **TaskManager.editingTaskId**: Currently editing task ID

#### **Persistence Layer**
- **localStorage**: Authentication tokens (`authToken`)
- **Server State**: Tasks, users, preferences via REST API
- **Session State**: Maintained through API calls

### **API Communication**

#### **API Layer** (`api.js`)
```javascript
// Core API methods
window.api = {
    getTasks(params),      // GET /api/tasks with filtering
    createTask(taskData),  // POST /api/tasks
    updateTask(id, data),  // PUT /api/tasks/:id
    deleteTask(id),        // DELETE /api/tasks/:id
    toggleTask(id, status), // PATCH /api/tasks/:id
    // ... auth methods
}
```

#### **Error Handling Pattern**
- **Client**: Try-catch with user-friendly toast messages
- **API**: Structured error responses with HTTP status codes
- **Form Validation**: Field-level error display with rollback

## Backend Architecture

### **Server Structure**
```
src/
├── app.js              # Express application setup
├── routes/             # API route handlers
├── middleware/         # Authentication, validation, CORS
├── database/           # SQLite database and schema
└── config/             # Environment configuration
```

### **Database Schema**
```sql
-- Core Tables
tasks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT DEFAULT 'medium',
    category TEXT DEFAULT 'general',
    completed BOOLEAN DEFAULT 0,
    due_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **API Design Patterns**

#### **RESTful Endpoints**
```
GET    /api/tasks              # List tasks with filtering
POST   /api/tasks              # Create new task
GET    /api/tasks/:id          # Get specific task
PUT    /api/tasks/:id          # Update task
DELETE /api/tasks/:id          # Delete task
PATCH  /api/tasks/:id/toggle   # Toggle completion status

POST   /api/auth/register      # User registration
POST   /api/auth/login         # User authentication
POST   /api/auth/logout        # Session termination
GET    /api/auth/me            # Current user info
```

#### **Response Format**
```javascript
// Success Response
{
    success: true,
    data: { /* response data */ },
    message: "Operation completed"
}

// Error Response
{
    success: false,
    error: "Error description",
    details: { /* validation errors */ }
}
```

## Security Architecture

### **Authentication Flow**
1. **Registration/Login**: Password hashing with bcrypt
2. **JWT Tokens**: Stateless authentication
3. **HTTP-Only Cookies**: Secure token storage
4. **Middleware Protection**: Route-level authentication

### **Data Protection**
- **Input Validation**: Server-side validation for all inputs
- **XSS Prevention**: HTML escaping via `escapeHtml()` utility
- **CSRF Protection**: Token-based protection (planned)
- **SQL Injection**: Parameterized queries only

## Performance Architecture

### **Frontend Optimization**
- **Direct DOM Manipulation**: No framework overhead
- **Event Delegation**: Efficient event handling
- **Lazy Loading**: Components loaded as needed
- **Debounced Search**: Prevents excessive API calls

### **Backend Optimization**
- **Database Indexing**: Optimized queries on user_id and status
- **Connection Pooling**: Efficient database connections
- **Response Caching**: Appropriate cache headers
- **Error Recovery**: Graceful degradation patterns

## Quality Assurance

### **Code Quality Patterns**
- **Separation of Concerns**: Clear module boundaries
- **Error Boundaries**: Comprehensive error handling
- **Defensive Programming**: Null checks and validation
- **Consistent Naming**: camelCase for JS, snake_case for SQL

### **Testing Strategy**
- **Browser Testing**: Real user interaction validation
- **API Testing**: Server endpoint validation
- **Integration Testing**: Full-stack workflow validation
- **Error Testing**: Edge case and failure scenario testing

## Deployment Architecture

### **Development Environment**
- **Local Server**: Node.js on localhost:3000
- **Database**: SQLite file-based storage
- **Hot Reload**: Development server with auto-restart
- **Debugging**: Console logging with structured messages

### **Production Readiness**
- **Environment Variables**: Configuration via .env
- **Database Migration**: SQLite to PostgreSQL path
- **Process Management**: PM2 or similar for production
- **Monitoring**: Application and error logging