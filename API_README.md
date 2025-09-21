# Todo List API

A RESTful API for a todo list application built with Node.js, Express.js, and SQLite.

## Features

- **Database Schema**: Users and tasks with proper relationships
- **Express.js Server**: RESTful API with middleware
- **Security**: CORS, rate limiting, security headers
- **Error Handling**: Comprehensive error management
- **Health Checks**: System monitoring endpoints
- **Testing**: Jest test suite with database testing
- **Validation**: Input validation with express-validator

## Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Run database migrations
npm run migrate

# Start development server
npm run dev
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint
```

## API Endpoints

### Core Endpoints

- `GET /` - Server information
- `GET /api` - API information and available endpoints
- `GET /api/health` - Health check
- `GET /api/health/detailed` - Detailed health information

### Planned Endpoints (Future Tasks)

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/users/profile` - User profile
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

## Database Schema

### Users Table

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tasks Table

```sql
CREATE TABLE tasks (
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
);
```

## Configuration

Environment variables are configured in `.env` file:

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production/test)
- `DB_PATH` - SQLite database file path
- `JWT_SECRET` - JWT signing secret
- `CORS_ORIGIN` - Allowed CORS origins
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window

## Security Features

- **CORS**: Configurable cross-origin resource sharing
- **Helmet**: Security headers middleware
- **Rate Limiting**: Request rate limiting
- **Input Validation**: Request validation with express-validator
- **Error Handling**: Safe error responses without sensitive data

## Architecture

```
src/
├── config/           # Configuration management
├── middleware/       # Express middleware
├── models/          # Database models and operations
├── routes/          # API route handlers
├── controllers/     # Business logic (future)
└── scripts/         # Utility scripts

tests/               # Test files
└── setup.js         # Test configuration
```

## Development

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run migrate` - Run database migrations
- `npm test` - Run test suite
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

### Database Operations

```bash
# Initialize database and run migrations
npm run migrate

# Database file location
./data/todolist.db
```

### Testing

The test suite includes:

- Database connection and migration tests
- API endpoint tests
- Security and middleware tests
- Error handling tests

## Performance Targets

- **API Response Time**: < 500ms
- **Database Queries**: Optimized with proper indexing
- **Memory Usage**: Monitored via health endpoints

## Next Steps

This foundation supports the following planned tasks:

1. **Task 3**: Authentication system with JWT
2. **Task 4**: User management endpoints
3. **Task 5**: Task CRUD operations
4. **Task 6**: Advanced task features
5. **Task 7**: API documentation
6. **Task 8**: Frontend integration
7. **Task 9**: Testing and optimization

## Contributing

1. Follow existing code style and patterns
2. Write tests for new functionality
3. Update documentation as needed
4. Run linting before committing

## License

MIT License