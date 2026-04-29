# Admin-Centralized User Management System Requirements

## Overview
This document outlines the backend API requirements for the admin-centralized user management system implemented in the frontend.

## System Architecture

### Roles
- **Admin**: Full system control, creates all users, and manages classes
- **Teacher**: Assigned to classes by admin, cannot create accounts
- **Parent**: Cannot create accounts, created only by admin
- **Student**: Cannot create accounts, created only by admin with grade level and section assigned

### Key Principle
**NO SELF-REGISTRATION**: Only admins can create accounts for all user types.

---

## API Endpoints Required

### 1. Authentication

#### `POST /auth/login`
Login endpoint (existing - no changes needed)

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt_token",
  "user": {
    "id": "user_id",
    "username": "string",
    "role": "Admin|Teacher|Parent|Student",
    "first_name": "string",
    "last_name": "string"
  }
}
```

---

### 2. User Management

#### `GET /api/admin/users`
Get all users (admin only)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "user_id",
    "first_name": "string",
    "last_name": "string",
    "username": "string",
    "email": "string",
    "role": "Admin|Teacher|Parent|Student",
    "grade_level": "Grade 7-12 (for students only)",
    "section": "Section A-D (for students only)",
    "created_at": "ISO8601_timestamp"
  }
]
```

#### `POST /api/admin/users`
Create a single user (admin only)

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request:**
```json
{
  "first_name": "string",
  "last_name": "string",
  "username": "string",
  "email": "string",
  "password": "string",
  "role": "Admin|Teacher|Parent|Student",
  "grade_level": "Grade 7-12 (optional, for students)",
  "section": "Section A-D (optional, for students)"
}
```

**Response:**
```json
{
  "id": "new_user_id",
  "message": "User created successfully"
}
```

#### `PATCH /api/admin/users/{userId}`
Update user information (admin only)

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request:**
```json
{
  "first_name": "string (optional)",
  "last_name": "string (optional)",
  "email": "string (optional)",
  "password": "string (optional)",
  "grade_level": "string (optional)",
  "section": "string (optional)"
}
```

**Response:**
```json
{
  "id": "user_id",
  "message": "User updated successfully"
}
```

#### `DELETE /api/admin/users/{userId}`
Delete a user (admin only)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "User deleted successfully"
}
```

#### `POST /api/admin/users/bulk-create`
Create multiple users from CSV data (admin only)

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request:**
```json
{
  "users": [
    {
      "name": "Juan Dela Cruz",
      "email": "juan@gmail.com",
      "role": "student",
      "grade_level": "Grade 7",
      "section": "Section A"
    },
    {
      "name": "Maria Santos",
      "email": "maria@gmail.com",
      "role": "parent"
    },
    {
      "name": "Leo Cruz",
      "email": "leo@gmail.com",
      "role": "teacher"
    }
  ]
}
```

**Response:**
```json
{
  "created_count": 3,
  "failed_count": 0,
  "message": "3 users created successfully",
  "results": [
    {
      "name": "Juan Dela Cruz",
      "username": "auto_generated_username",
      "password": "auto_generated_password",
      "status": "success"
    }
  ]
}
```

**Notes:**
- Automatically generate usernames and passwords
- Can optionally send credentials via email (if configured)
- Students MUST have grade_level and section
- Teachers and Parents do NOT need grade_level/section

---

### 3. Class Management

#### `GET /api/admin/classes`
Get all classes (admin only)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "class_id",
    "grade_level": "Grade 7",
    "section": "Section A",
    "teacher_id": "teacher_id",
    "student_count": 35,
    "created_at": "ISO8601_timestamp"
  }
]
```

#### `POST /api/admin/classes`
Create a new class with students and teacher (admin only)

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request:**
```json
{
  "grade_level": "Grade 7",
  "section": "Section A",
  "teacher_id": "teacher_user_id",
  "student_ids": ["student_id_1", "student_id_2", "student_id_3", ...]
}
```

**Response:**
```json
{
  "id": "new_class_id",
  "grade_level": "Grade 7",
  "section": "Section A",
  "teacher_id": "teacher_id",
  "student_count": 35,
  "message": "Class created successfully with 35 students"
}
```

**Notes:**
- At least one student is required
- Teacher must exist and be a valid teacher user
- Grade level and section combination should be unique (optional - depends on business logic)

#### `DELETE /api/admin/classes/{classId}`
Delete a class (admin only)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "message": "Class deleted successfully"
}
```

**Notes:**
- Deleting a class does NOT delete the students, only removes the class grouping
- Students remain in the system with their assigned grade_level and section

#### `GET /api/admin/classes/{gradeLevel}/{section}/students`
Get all students in a specific class (admin only)

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
[
  {
    "id": "student_id",
    "first_name": "string",
    "last_name": "string",
    "username": "string",
    "email": "string",
    "grade_level": "Grade 7",
    "section": "Section A"
  }
]
```

---

### 5. Analytics (Existing)

#### `GET /api/admin/dashboard/analytics`
Get dashboard analytics (no changes needed)

---

## Database Schema Additions

### Users Table (Update Existing)
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS grade_level VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS section VARCHAR(20);
```

### Classes Table (Create New)
```sql
CREATE TABLE classes (
  id VARCHAR(36) PRIMARY KEY,
  grade_level VARCHAR(20) NOT NULL,
  section VARCHAR(20) NOT NULL,
  teacher_id VARCHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(grade_level, section)
);
```

### Class Students Junction Table (Create New)
```sql
CREATE TABLE class_students (
  id VARCHAR(36) PRIMARY KEY,
  class_id VARCHAR(36) NOT NULL,
  student_id VARCHAR(36) NOT NULL,
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(class_id, student_id)
);
```

---

## CSV Upload Format

The frontend accepts CSV files with the following format:

```csv
name,email,role,grade_level,section
Juan Dela Cruz,juan@gmail.com,student,Grade 7,Section A
Maria Santos,maria@gmail.com,parent,
Leo Cruz,leo@gmail.com,teacher,
```

**Column Requirements:**
- `name` - Full name (required)
- `email` - Email address (required, must be unique)
- `role` - One of: student, parent, teacher, admin (required)
- `grade_level` - Required for students, optional for others
- `section` - Required for students, optional for others

**Backend Implementation:**
1. Parse CSV data from request
2. Validate all required fields
3. Auto-generate username (e.g., first_name + last_name + random suffix)
4. Auto-generate temporary password
5. Create all users in bulk
6. (Optional) Send credentials via email
7. Return summary of created/failed users

---

## Security Considerations

1. **Authentication Required**: All admin endpoints require valid JWT token with "Admin" role
2. **Authorization**: Only admins can create, update, delete, or assign users/classes/teachers
3. **Data Validation**: 
   - Usernames must be unique
   - Emails must be valid and unique
   - Roles must be one of: Admin, Teacher, Parent, Student
   - Students must have grade_level and section assigned
4. **Password Handling**:
   - Hash passwords before storing (bcrypt recommended)
   - For CSV uploads, generate secure random passwords
5. **Rate Limiting**: Consider rate limiting bulk upload endpoint
6. **Audit Logging**: Log all admin actions (user creation, deletion, class assignment)

---

## Frontend Implementation Status

✅ **Completed:**
- Tabbed admin dashboard interface
- Individual user creation form (with role-based fields)
- CSV bulk upload form
- Class management with admin-created classes
- Student selection for class enrollment
- Delete class functionality
- API integration layer
- Form validation and error handling
- Success/feedback messages

⏳ **Pending Backend Implementation:**
- All API endpoints listed above (especially class creation and management)
- Database schema updates (Classes and Class_Students tables)
- CSV processing and bulk user creation logic
- Authentication/authorization checks
- Auto-password generation for bulk uploads
- Class-student enrollment logic

---

## Testing Checklist

- [ ] Create admin user through individual form
- [ ] Create student with grade level and section
- [ ] Create parent without grade level/section
- [ ] Upload CSV with multiple users
- [ ] Edit existing user (change role, grade, section)
- [ ] Delete user
- [ ] **Create a new class with grade, section, and teacher**
- [ ] **Select students when creating a class**
- [ ] **View all students added to a created class**
- [ ] **Delete a class (verify students remain in system)**
- [ ] **Verify "Select All" checkbox selects all students**
- [ ] **Create class with minimum 1 student**
- [ ] **Attempt to create class without students (should fail)**
- [ ] **View existing classes in the table**
- [ ] Select class and view students
- [ ] Edit existing user (change role, grade, section)
- [ ] Delete user
- [ ] Verify only admins can access admin dashboard
- [ ] Test error handling for invalid CSV format
- [ ] Test error handling for class creation with missing fields

