# Uganda Multi-School Management System - Schema Documentation

## Overview

This schema is designed for a comprehensive multi-school management system tailored for the Uganda education system. It supports multiple schools under a single platform, with each school having its own isolated data and configurations.

## System Architecture

### Multi-Tenancy Model

```
Platform Admin (Super Admin)
    └── Creates School
        └── Assigns School Admin
            └── School Admin manages:
                ├── Teachers
                ├── Students
                ├── Parents
                ├── Other Staff
                └── All School Operations
```

## User Roles & Access Control

### Role Hierarchy

1. **Platform Admin** - Manages the entire platform, can create schools and assign school admins
2. **School Admin** - Manages a specific school (configures settings, manages staff, etc.)
3. **Head Teacher** - Senior academic authority within a school
4. **Deputy Head** - Assists the head teacher
5. **Director of Studies (DOS)** - Manages academic programs
6. **Bursar** - Manages finances
7. **Teacher** - Handles teaching and marks entry
8. **Class Teacher** - Additional responsibilities for a specific class
9. **Librarian** - Manages library
10. **Parent** - Views child's information
11. **Student** - Views own academic information

### Permission System

The `Role` model includes a `permissions` array that can contain granular permissions:

```
- students:read
- students:create
- students:update
- students:delete
- fees:read
- fees:create
- fees:collect
- exams:create
- exams:enter_marks
- reports:generate
- etc.
```

## Core Modules

### 1. School Setup & Configuration

When a school is onboarded:

```typescript
// 1. Platform Admin creates a school
const school = await prisma.school.create({
  data: {
    name: "St. Mary's Secondary School",
    code: "SMS001",
    slug: "st-marys-secondary",
    adminId: schoolAdminUserId,
    // ... other details
  }
});

// 2. Configure branding
// Logo, colors, badge, etc.

// 3. Set up academic structure
// Academic years → Terms → Classes → Streams
```

### 2. Academic Structure

```
School
└── Academic Year (2025)
    └── Terms (Term 1, Term 2, Term 3)
        └── Classes (P.1, P.2, S.1, S.2)
            └── Streams (A, B, East, West)
                └── Students
```

### 3. Students & Admissions Flow

```
Admission Application
    ↓
Under Review
    ↓
Interview (Optional)
    ↓
Admitted
    ↓
Enrolled → Student Record Created
```

### 4. Examination & Grading System

The system supports Uganda's grading systems:

**Primary Level (Uganda)**
| Grade | Marks | Points |
|-------|-------|--------|
| D1 | 90-100 | 1 |
| D2 | 80-89 | 2 |
| C3 | 70-79 | 3 |
| C4 | 60-69 | 4 |
| C5 | 50-59 | 5 |
| C6 | 40-49 | 6 |
| P7 | 30-39 | 7 |
| P8 | 20-29 | 8 |
| F9 | 0-19 | 9 |

**Secondary Level (O-Level/A-Level)**
| Grade | Marks | Points |
|-------|-------|--------|
| A | 80-100 | 1 |
| B | 70-79 | 2 |
| C | 60-69 | 3 |
| D | 50-59 | 4 |
| E | 40-49 | 5 |
| O | 30-39 | 6 |
| F | 0-29 | 7 |

### 5. Report Card Generation

```
Student + Term
    ↓
Fetch All Exam Results
    ↓
Calculate:
- Total Marks
- Average
- Aggregate Points
- Position/Rank
- Division (Secondary)
    ↓
Add Comments (Class Teacher, Head Teacher)
    ↓
Generate PDF
    ↓
Publish to Parent/Student Portal
```

### 6. Finance & Fees

**Fee Structure Setup:**
```
Fee Structure
├── Tuition Fee (Per Term)
├── Boarding Fee (Boarders Only)
├── Lunch Fee (Day Scholars)
├── Transport Fee (Optional)
├── Uniform
├── Books
└── Development Levy
```

**Payment Flow:**
```
Fee Invoice Generated
    ↓
Payment Made (Cash/Bank/Mobile Money/SchoolPay)
    ↓
Receipt Generated
    ↓
Balance Updated
    ↓
SMS Notification to Parent
```

### 7. SchoolPay Integration

SchoolPay is Uganda's popular school payment gateway. Configuration stored per school:

```typescript
const schoolPayConfig = {
  merchantCode: "SCHOOL_MERCHANT_CODE",
  apiKey: "api_key",
  secretKey: "secret_key",
  environment: "production", // or "sandbox"
  webhookUrl: "https://yourapp.com/webhooks/schoolpay"
};
```

### 8. Attendance Tracking

Supports two modes:

1. **Daily Attendance** - Mark once per day
2. **Subject-wise Attendance** - Mark per subject/period

```typescript
// Daily attendance
{
  date: "2025-02-15",
  studentId: "...",
  status: "PRESENT"
}

// Subject-wise
{
  date: "2025-02-15",
  studentId: "...",
  subjectId: "...",
  period: 3,
  status: "PRESENT"
}
```

### 9. Library Management

```
Book Entry
    ↓
Available for Loan
    ↓
Student Borrows (Issue Date + Due Date)
    ↓
Return / Overdue
    ↓
Fine Calculation (if late)
```

### 10. Health Tracker

Tracks:
- Routine health checkups
- Sick visits
- Immunization records
- Emergency medical info
- Allergies and chronic conditions

### 11. Timetable Management

```
Timetable (Per Class/Stream/Term)
└── Entries
    ├── Monday, Period 1: Math (Teacher: John)
    ├── Monday, Period 2: English (Teacher: Mary)
    └── ...
```

### 12. SMS Integration

Supports multiple providers:
- Africa's Talking
- Infobip
- Twilio
- Local Uganda providers

Use cases:
- Fee reminders
- Exam results
- Attendance alerts
- General announcements

## Key Relationships

### User → Multiple Profiles
A single user can have multiple profiles depending on their role:
- Teacher profile
- Parent profile
- Student profile
- Employee profile

### School Isolation
All school-specific data includes `schoolId` for proper data isolation:
```prisma
model Student {
  // ...
  schoolId String
  school   School @relation(...)
}
```

### Audit Trail
All significant operations are logged in `ActivityLog`:
```typescript
{
  userId: "user_123",
  action: "CREATE",
  module: "student",
  entityType: "Student",
  entityId: "student_456",
  oldData: null,
  newData: { /* student data */ }
}
```

## Database Indexes

Key indexes for performance:
- All `schoolId` fields (multi-tenant queries)
- `email`, `phone` fields (authentication)
- Status fields (filtering)
- Date fields (range queries)
- Foreign keys (joins)

## Seed Data Recommendations

### Initial Platform Setup
1. Create system roles (Platform Admin, School Admin, etc.)
2. Create default grade scales
3. Create system settings

### Per School Setup
1. Create academic year and terms
2. Create classes and streams
3. Set up subjects
4. Configure fee structures
5. Import/create teachers
6. Configure SMS and SchoolPay

## API Endpoints Structure (Suggested)

```
/api/auth/*              - Authentication
/api/admin/*             - Platform admin operations
/api/schools/*           - School management
/api/schools/:id/setup/* - School configuration
/api/students/*          - Student CRUD
/api/teachers/*          - Teacher CRUD
/api/parents/*           - Parent CRUD
/api/admissions/*        - Admission flow
/api/exams/*             - Examination management
/api/marks/*             - Marks entry
/api/reports/*           - Report cards
/api/fees/*              - Fee management
/api/payments/*          - Payment processing
/api/attendance/*        - Attendance
/api/library/*           - Library management
/api/timetable/*         - Timetable
/api/events/*            - Calendar/Events
/api/sms/*               - SMS sending
/api/notifications/*     - In-app notifications
/api/health/*            - Health records
```

## Frontend Routes Structure (Suggested)

```
/                        - Landing page
/login                   - Login
/admin                   - Platform admin dashboard
/school/:slug            - School landing
/school/:slug/dashboard  - School admin dashboard
/school/:slug/students   - Students management
/school/:slug/teachers   - Teachers management
/school/:slug/academics  - Academic management
/school/:slug/exams      - Examinations
/school/:slug/fees       - Fee management
/school/:slug/reports    - Report cards
/school/:slug/library    - Library
/school/:slug/attendance - Attendance
/school/:slug/settings   - School settings
```

## Security Considerations

1. **Row-Level Security** - Always filter by schoolId
2. **Role-Based Access** - Check permissions before operations
3. **Password Hashing** - Use bcrypt with salt rounds ≥ 12
4. **JWT Tokens** - Short expiry (15min access, 7days refresh)
5. **Rate Limiting** - Especially on auth endpoints
6. **Input Validation** - Use Zod or similar
7. **SQL Injection** - Prisma protects, but validate inputs
8. **XSS Protection** - Sanitize all user inputs
9. **Audit Logging** - Log all sensitive operations

## Deployment Recommendations

1. **Database** - PostgreSQL (Supabase, Neon, or self-hosted)
2. **File Storage** - AWS S3, Cloudinary, or UploadThing
3. **Hosting** - Vercel, Railway, or VPS
4. **SMS Gateway** - Africa's Talking (best for Uganda)
5. **Payment Gateway** - SchoolPay (primary), Mobile Money (backup)

## Future Enhancements

1. **Online Learning** - Video classes, assignments
2. **Transport Tracking** - GPS tracking of school buses
3. **Cafeteria Management** - Meal planning and billing
4. **Alumni Management** - Track graduates
5. **Mobile Apps** - Native iOS/Android apps
6. **Biometric Attendance** - Fingerprint/face recognition
7. **AI Report Comments** - Auto-generate teacher comments
8. **Parent-Teacher Meetings** - Online scheduling
9. **Hostel Management** - Room allocation, leave requests
10. **Procurement** - Purchase orders, vendor management