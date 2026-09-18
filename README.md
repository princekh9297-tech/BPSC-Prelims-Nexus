# BPSC Prelims Nexus — Fixed Server Auth Deployment

This package fixes the Render error:
`ENOENT: no such file or directory, stat '/opt/render/project/src/protected/app.html'`

The required protected/app.html is included and is the server-auth standalone BPSC Prelims Test Series frontend.

Deploy this package to the existing `BPSC-Prelims-Nexus-Auth` Render Web Service.

Environment variables:
- DATABASE_URL = your Render Postgres Internal Database URL
- ADMIN_ID = your chosen admin ID
- ADMIN_PASSWORD = your chosen admin password

Do not create a new database or service.
