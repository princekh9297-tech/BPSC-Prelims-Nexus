# BPSC Prelims Nexus — Server Authentication

This package uses the exact BPSC Prelims Test Series source as `protected/app.html`. It does NOT include the BPSC Nexus Master Vault.

## Deploy on Render
1. Put these files in your GitHub repository, preserving `protected/app.html`.
2. Deploy as a Node Web Service, or use the included `render.yaml`.
3. Attach/provision PostgreSQL and ensure `DATABASE_URL` is available.
4. Set `ADMIN_ID` and `ADMIN_PASSWORD` in Render Environment.
5. Deploy.

## Default admin (change before production)
ID: ADMIN
Password: BPN@ADMIN2026

## Access flow
- `/` is the login page.
- Student credentials are checked server-side.
- `/app` is protected by the server and redirects unauthenticated visitors to `/`.
- The original Prelims Test Series is served only after successful student authentication.
- Admin can create, view, block, activate and expire student accounts.

Note: the original question bank remains inside `protected/app.html`, so authenticated students can inspect its client-side source. For stronger paid-content protection, move the question bank into authenticated API/database storage and score submissions server-side.
