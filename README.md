# Admin & Teacher Dashboard (React)

Role-based dashboard app for the BatangAware backend.

## Features

- Secure login via `POST /auth/login`
- JWT session persistence in browser storage with expiry checks
- Role-protected routes for:
	- Admin dashboard (`/admin`)
	- Teacher dashboard (`/teacher`)
- Admin tools:
	- Platform analytics summary (`GET /api/admin/dashboard/analytics`)
	- User CRUD (`GET/POST/PATCH/DELETE /api/admin/users`)
- Teacher tools:
	- Class overview with student performance (`GET /teacher/class/overview`)
	- Create class (`POST /teacher/class`)
	- Create quiz (`POST /teacher/quiz`)

## Run locally

```bash
npm install
npm run dev
```

By default, the Vite dev server proxies backend requests to `http://127.0.0.1:5000`.

You can override proxy target:

```bash
VITE_API_PROXY_TARGET=http://localhost:5000 npm run dev
```

Or set direct API base URL (useful for deployed API):

```bash
VITE_API_BASE_URL=https://your-api-domain.com npm run dev
```

## Backend account roles

Only `Admin` and `Teacher` accounts can access this dashboard UI.
