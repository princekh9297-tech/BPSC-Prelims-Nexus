# BPSC Prelims Nexus — Render/GitHub Package

This is a repository-ready static deployment package.

## Structure

- `index.html` — complete application and unified test database
- `render.yaml` — Render Static Site configuration

## Deployment

1. Create a new GitHub repository.
2. Upload `index.html` and `render.yaml` to the repository root.
3. In Render, create a **Static Site** from that GitHub repository.
4. Render will serve `index.html` at one permanent URL.
5. For future updates, replace/update `index.html` in GitHub and push the commit. Render will auto-deploy the new version.

## Database architecture

All currently included tests remain in the same client-side `TEST_BANKS` database inside `index.html`. No separate test database/files are used for these tests.

Current 72nd BPSC Prelims Plus tests:

- Test 1 — 100 questions — English Medium
- Test 2 — 100 questions — English Medium
- Test 3 — 100 questions — English Medium

The source-restricted question, answer and explanation content is embedded in the single HTML application.
