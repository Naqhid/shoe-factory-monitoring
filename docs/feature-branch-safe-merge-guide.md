# Feature Branch Workflow and Safe Merge Guide

This guide explains how to work in a feature branch without impacting live production, and how to merge safely into `develop` (your live production branch).

For Mobile Production reliability checks, use: [Mobile Production Stability Checklist](./mobile-production-stability-checklist.md)

---

## 1) Branch Model Used in This Repo

- `develop` = live production branch (treat as protected)
- `feature/<name>` = isolated development work
- Only merge to `develop` through Pull Request (PR)

---

## 2) Golden Rules (No Production Impact)

1. Never run experimental backend on production port (`3001`) if production is active.
2. Run feature backend on a separate port (example: `3101`).
3. Run feature frontend on a separate port (example: `3004` or `3100`).
4. Keep local override values in local-only env files (`.env.local`), not committed secrets.
5. Do not push directly to `develop`.

---

## 3) Start a New Feature Branch Safely

From repository root:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

This ensures your branch starts from the latest live baseline.

---

## 4) Local Runtime Isolation (Recommended)

### 🔒 Do Not Forget (Feature Ports)

- **Feature backend port:** `3101`
- **Feature frontend port:** `3004`
- **Live production backend port:** `3001` (do not use for feature testing)

Use these exact commands each time:

```bash
# Terminal 1 (backend)
cd backend
PORT=3101 npm start

# Terminal 2 (frontend)
cd frontend
npm run dev -- --port 3004 --host 0.0.0.0
```

Optional quick checks:

```bash
# Backend health
curl http://localhost:3101/health

# Frontend
start http://localhost:3004
```

### Backend (feature)

From `backend/`:

```bash
PORT=3101 npm start
```

### Frontend (feature)

From `frontend/`:

```bash
npm run dev -- --port 3004 --host 0.0.0.0
```

### API target isolation in frontend

Use a local env override:

`frontend/.env.local`

```env
VITE_API_BASE_URL=http://localhost:3101
```

This keeps feature frontend talking to feature backend.

> Note: `.env.local` is local-only and ignored by git, so it does not deploy to production.

---

## 5) Daily Feature Branch Workflow

```bash
git checkout feature/my-feature
git add .
git commit -m "feat: <clear change summary>"
git push origin feature/my-feature
```

Before opening PR, sync with latest `develop`:

```bash
git checkout develop
git pull origin develop
git checkout feature/my-feature
git merge develop
```

Resolve conflicts in feature branch, retest, then push again.

---

## 6) Pre-PR Safety Checklist

- [ ] App runs in feature branch without using production ports.
- [ ] Frontend API points to intended backend (feature env override for local testing).
- [ ] No accidental `.env`/credential files staged.
- [ ] Build and core flows tested locally.
- [ ] Only intended files changed.

Quick check:

```bash
git status
git diff --name-only develop...feature/my-feature
```

---

## 7) Safe Merge Process to `develop`

1. Open PR: `feature/my-feature` -> `develop`.
2. Require review before merge.
3. Confirm CI checks/build checks pass.
4. Prefer **Squash and merge** (clean history for hotfix rollback).
5. Merge only during planned window (if your team has one).

---

## 8) Why This Does Not Break Production

- A GitHub commit does **not** change live production by itself.
- Production changes only when deployment runs from merged code.
- Local `frontend/.env.local` is not committed, so `VITE_API_BASE_URL=http://localhost:3101` does not go to production.
- In production, values come from production environment variables and deployment config.

---

## 9) Post-Merge Verification (Develop/Production)

After merge/deploy:

- Check backend health endpoint.
- Verify dashboard loads and key API routes respond.
- Verify no unexpected CORS/auth errors.
- Monitor logs for 15-30 minutes.

---

## 10) Rollback Plan (If Needed)

If a merge causes issues:

1. Revert the merge commit in `develop`.
2. Redeploy reverted `develop`.
3. Investigate in a new `feature/fix-*` branch.

Example:

```bash
git checkout develop
git pull origin develop
git revert <merge_commit_sha>
git push origin develop
```

---

## 11) Common Mistakes to Avoid

- Running feature backend on `3001` while production service is running.
- Testing feature UI against live backend unintentionally.
- Merging without syncing latest `develop` first.
- Committing local machine-specific env/secrets.

---

## 12) Quick Reference Commands

```bash
# New feature branch
git checkout develop && git pull origin develop && git checkout -b feature/<name>

# Feature backend isolated
cd backend && PORT=3101 npm start

# Feature frontend isolated
cd frontend && npm run dev -- --port 3004 --host 0.0.0.0

# Push feature branch
git add . && git commit -m "feat: ..." && git push origin feature/<name>
```
