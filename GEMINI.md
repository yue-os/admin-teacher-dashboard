Here is a gemini.md file you can place in the root of your frontend repository. This file serves as a system prompt and architectural guideline for any AI assistant you use, ensuring that all code generated for the BatangAware admin, teacher, and parent dashboards meets production standards.

Markdown

# Context: BatangAware Dashboard Frontend

## Project Overview
*   **Game Context:** BatangAware is a multiplayer social deduction card game.
*   **App Purpose:** A React + Vite frontend dashboard for managing game data, user accounts (Admins, Teachers, Parents), and analytics.
*   **Stack:** React, Vite, Yarn, ESLint.

## AI Assistant Instructions
When generating, refactoring, or reviewing code for this repository, you must adhere to the following production-ready standards:

### 1. Security & Role-Based Access Control (RBAC)
*   **Strict Routing:** Ensure `AdminDashboard.jsx`, `TeacherDashboard.jsx`, and `ParentDashboard.jsx` are strictly protected behind robust authentication guards (e.g., in `ProtectedRoute.jsx`).
*   **Token Management:** Store JWTs or session tokens securely (prefer HttpOnly cookies over localStorage if the backend supports it, otherwise manage memory state securely).
*   **Graceful Degradation:** Unauthorized access must immediately redirect to `UnauthorizedPage.jsx` or `LoginPage.jsx` without leaking restricted UI components or API data.

### 2. State Management & API Integration
*   **Backend Sync:** The frontend connects to a robust backend (potentially utilizing SignalR for real-time card game updates or standard REST/FastAPI endpoints for the CMS). Ensure all `lib/api.js` calls handle timeouts, network failures, and 5xx errors gracefully.
*   **Data Fetching:** Implement caching and deduplication (using tools like React Query or SWR if available) to prevent redundant calls when switching between dashboard views.

### 3. Performance & Optimization (Vite)
*   **Code Splitting:** Lazy load route components. `AdminDashboard`, `TeacherDashboard`, and `ParentDashboard` should not be bundled together in the initial load.
    
```javascript
    const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
    ```
*   **Asset Management:** Ensure SVGs (`react.svg`, `vite.svg`, `icons.svg`) and images (`hero.png`) are properly optimized and served from the `public/` or `assets/` directory with appropriate cache headers.

### 4. Error Handling & Reliability
*   **Global Boundaries:** Wrap the application in an Error Boundary to prevent the entire React tree from unmounting on unhandled exceptions.
*   **User Feedback:** Implement toast notifications or alerts for all API mutations (e.g., "User successfully added" or "Failed to update permissions").

### 5. Code Quality & Deployment
*   **Linting:** Strictly follow the rules defined in `eslint.config.js`. Do not leave `console.log` statements in production-ready code.
*   **Environment Variables:** Never hardcode API URLs. Always use `import.meta.env.VITE_API_URL` and ensure sensitive keys are not exposed to the client bundle.
*   **Resilience:** The app must be configured to handle deployment environments reliably (e.g., ensuring client-side routing works by redirecting all traffic to `index.html` in Railway, Vercel, or Nginx configurations).

## Task Execution
When asked to write or modify code, begin by briefly stating which of the above principles are being applied, then output the strictly formatted, production-ready code.