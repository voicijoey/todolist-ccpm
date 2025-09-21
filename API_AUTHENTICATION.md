# Authentication API Documentation

## Overview
The authentication system provides JWT-based user authentication and authorization for the Todo List API.

## Endpoints

### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2025-01-20T10:30:00.000Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### POST /api/auth/login
Authenticate user and receive JWT tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Tokens refreshed successfully",
  "data": {
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
}
```

### POST /api/auth/logout
Logout user (client-side token removal).

**Response (200):**
```json
{
  "success": true,
  "message": "Logout successful. Please remove tokens from client storage."
}
```

### GET /api/auth/profile
Get current user profile (Protected).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "created_at": "2025-01-20T10:30:00.000Z",
      "updated_at": "2025-01-20T10:30:00.000Z"
    }
  }
}
```

### PUT /api/auth/profile
Update user profile (Protected).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "first_name": "Jane",
      "last_name": "Smith",
      "created_at": "2025-01-20T10:30:00.000Z",
      "updated_at": "2025-01-20T11:00:00.000Z"
    }
  }
}
```

## Authentication Flow

1. **Register/Login**: User receives access token (1 hour) and refresh token (7 days)
2. **API Requests**: Include access token in Authorization header: `Bearer <token>`
3. **Token Refresh**: Use refresh token to get new access token before expiration
4. **Logout**: Client removes tokens from storage

## Security Features

- **Password Requirements**: Minimum 8 characters, uppercase, lowercase, number
- **Rate Limiting**: 5 attempts per 15 minutes for auth endpoints
- **JWT Security**: Tokens signed with secret from environment
- **Password Hashing**: bcrypt with 12 salt rounds
- **Input Validation**: Comprehensive validation on all inputs

## Error Responses

**Validation Error (400):**
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address",
      "value": "invalid-email"
    }
  ]
}
```

**Authentication Error (401):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

**Rate Limit Error (429):**
```json
{
  "success": false,
  "message": "Too many authentication attempts, please try again in 15 minutes"
}
```

## Usage Examples

### cURL Examples

**Register:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123","firstName":"John","lastName":"Doe"}'
```

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Password123"}'
```

**Profile (Protected):**
```bash
curl -X GET http://localhost:3000/api/auth/profile \
  -H "Authorization: Bearer <your_access_token>"
```

### JavaScript Example

```javascript
// Register
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123',
    firstName: 'John',
    lastName: 'Doe'
  })
});

// Login and store tokens
const loginResponse = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'Password123'
  })
});

const { tokens } = await loginResponse.json();
localStorage.setItem('accessToken', tokens.accessToken);
localStorage.setItem('refreshToken', tokens.refreshToken);

// Use protected endpoint
const profileResponse = await fetch('/api/auth/profile', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```