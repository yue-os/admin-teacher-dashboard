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

If you are opening the dashboard from another PC, point it at the backend machine's LAN IP instead of `127.0.0.1`:

```bash
VITE_API_PROXY_TARGET=http://192.168.1.7:5000 npm run dev
```

Or set a direct API base URL, which is the safer option for a built app or a remote frontend:

```bash
VITE_API_BASE_URL=http://192.168.1.7:5000 npm run dev
```

Make sure Windows Firewall on the backend PC allows inbound TCP traffic on port `5000`.

## Backend account roles

Only `Admin` and `Teacher` accounts can access this dashboard UI.
