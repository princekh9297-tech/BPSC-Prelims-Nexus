# BPSC Prelims Nexus — Server Auth Standalone

## What this changes
The standalone HTML authenticates against the BPSC Prelims Nexus Render server at:
https://bpsc-prelims-nexus-auth.onrender.com

It does **not** contain an Admin password, student database, or account-generation logic.

## Required server deployment
Deploy the updated `server.js` in this folder to the existing Render Web Service. Keep these environment variables:
- `DATABASE_URL` = Render Postgres Internal Database URL
- `ADMIN_ID` = your chosen admin ID
- `ADMIN_PASSWORD` = your chosen admin password

The updated server supports bearer session tokens for the standalone HTML and CORS for `Origin: null` (local file) and the Render site origin.

## Important
The standalone HTML must be opened with internet access because authentication is performed by the server. It is a single-file frontend, not an offline authentication system.
