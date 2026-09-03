#auto form fill
# Ashok Goel Library - Cabin Booking Portal

A full-stack library cabin booking system with student and admin portals.

## Architecture

```
Ashok-Goel-Library/
├── backend/              Node.js + Express + MongoDB API
├── student-frontend/     Next.js Student Portal
├── admin-frontend/       Next.js Admin Portal
```

## Tech Stack

- **Backend**: Node.js, Express, Mongoose, JWT, Zod
- **Student Frontend**: Next.js, @react-oauth/google
- **Admin Frontend**: Next.js
- **Database**: MongoDB
- **Auth**: Google Sign-In (students), Username/Password (admins)

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Google Cloud project with OAuth 2.0 Client ID

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services > Credentials**
4. Click **Create Credentials > OAuth 2.0 Client ID**
5. Select **Web application**
6. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - Your production student frontend URL
7. Add authorized redirect URIs:
   - `http://localhost:3000` (development)
   - Your production student frontend URL
8. Copy the **Client ID** (it looks like `xxxxx.apps.googleusercontent.com`)
9. Navigate to **APIs & Services > OAuth consent screen**
10. Configure the consent screen (External or Internal based on your needs)
11. Add test users if using External type

## Installation

### 1. Clone and setup

```bash
git clone <repository-url>
cd Ashok-Goel-Library
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values (MongoDB URI, JWT secrets, Google Client ID, etc.)
```

### 3. Seed Database

```bash
npm run seed
# Creates root admin and 5 default cabins (P1-P5)
```

### 4. Student Frontend

```bash
cd ../student-frontend
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL and NEXT_PUBLIC_GOOGLE_CLIENT_ID
```

### 5. Admin Frontend

```bash
cd ../admin-frontend
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL
```

## Running in Development

Open 3 terminal windows:

```bash
# Terminal 1 - Backend (port 5000)
cd backend
npm run dev

# Terminal 2 - Student Frontend (port 3000)
cd student-frontend
npm run dev

# Terminal 3 - Admin Frontend (port 3001)
cd admin-frontend
npm run dev -- -p 3001
```

## Running Tests

```bash
cd backend
npm test
```

## Default Cabins

| Code | Name | Min People | Max People |
|------|------|-----------|-----------|
| P1 | Cabin P1 | 2 | 6 |
| P2 | Cabin P2 | 2 | 6 |
| P3 | Cabin P3 | 4 | 10 |
| P4 | Cabin P4 | 2 | 4 |
| P5 | Cabin P5 | 2 | 4 |

## Booking Flow

1. Student signs in with Google (rishihood.edu.in email only)
2. Student selects an available cabin and fills the booking form
3. Request enters **pending** status (10-minute approval window)
4. Admin approves or rejects the request
5. If approved, a **2-hour booking timer** starts
6. After 2 hours, the booking is automatically completed

## API Endpoints

### Student

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/google | Google login |
| POST | /api/auth/logout | Logout |
| GET | /api/me | Get current user |
| GET | /api/cabins/status | Get cabin availability |
| POST | /api/bookings/request | Create booking request |
| GET | /api/bookings/my-active | Get active booking |
| GET | /api/bookings/my-history | Get booking history |
| POST | /api/bookings/:id/cancel-pending | Cancel pending request |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/admin/auth/login | Admin login |
| POST | /api/admin/auth/logout | Admin logout |
| GET | /api/admin/me | Get current admin |
| GET | /api/admin/dashboard | Dashboard data |
| GET | /api/admin/bookings/:id | Booking details |
| POST | /api/admin/bookings/:id/approve | Approve booking |
| POST | /api/admin/bookings/:id/reject | Reject booking |
| POST | /api/admin/bookings/:id/cancel | Cancel booking |
| GET | /api/admin/analytics | Analytics data |
| GET | /api/admin/cabins | List cabins |
| POST | /api/admin/cabins | Create cabin (root) |
| PATCH | /api/admin/cabins/:id | Update cabin |
| GET | /api/admin/users | List admins (root) |
| POST | /api/admin/users | Create admin (root) |
| PATCH | /api/admin/users/:id | Update admin (root) |
| DELETE | /api/admin/users/:id | Delete admin (root) |

## Security

- Backend Google token verification
- Email domain validation (rishihood.edu.in only)
- HTTP-only cookies + localStorage JWT
- Separate student/admin auth with different JWT secrets
- Role-based admin authorization
- Rate limiting on login and booking endpoints
- Helmet security headers
- CORS allowlist
- Server-side Zod validation
- Input normalization (enrollment uppercase, phone digits)
- MongoDB injection protection via Mongoose
- Audit logging for admin actions
- Atomic operations for race condition prevention

## Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import each frontend as a separate Vercel project
3. Set environment variables in Vercel dashboard
4. Configure build settings (auto-detected for Next.js)

### Backend (Vercel/AWS)

1. For Vercel: Create a `vercel.json` for Express
2. For AWS: Deploy via EC2, ECS, or Lambda
3. Use MongoDB Atlas for the database
4. Set all environment variables

## Environment Variables

See `backend/.env.example` for the complete list.
# ashok-goel-library
