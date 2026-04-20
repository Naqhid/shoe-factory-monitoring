# Mobile Production Stability Checklist

Use this checklist to ensure `MobileProduction` remains stable during live monitoring and refresh scenarios.

---

## 1) Runtime Setup (Must Be Correct)

- [ ] Backend is running on feature port `3101`
  - Command: `cd backend && PORT=3101 npm start`
- [ ] Frontend is running on feature port `3004`
  - Command: `cd frontend && npm run dev -- --port 3004 --host 0.0.0.0`
- [ ] Frontend API points to feature backend
  - File: `frontend/.env.local`
  - Value: `VITE_API_BASE_URL=http://localhost:3101`
- [ ] Backend was restarted after route/controller changes

---

## 2) Data Preconditions

- [ ] Machine ID in URL exists in `machine_centres`
- [ ] Employee code in URL exists in `employees`
- [ ] Work centre mapping is valid
- [ ] Database connection is healthy (no connection/auth timeout errors)

---

## 3) Critical Functional Checks (Mobile Production)

- [ ] Opening `/mobile/<machine>/<employee>` loads production page without errors
- [ ] Clicking `START` creates/uses active unfinished production record
- [ ] Timer starts and increments continuously
- [ ] Refresh during active run restores same cycle (does not reset to new cycle)
- [ ] `FINISH` remains available for active run (does not unexpectedly switch to `START`)
- [ ] Clicking `FINISH` updates cycle to finished state correctly
- [ ] Clicking `RESET` prepares next cycle intentionally

---

## 4) Refresh & Resilience Tests (Most Important)

- [ ] Start production, wait 30-120 seconds, refresh page
- [ ] Confirm timer resumes from current cycle (not zero)
- [ ] Confirm state remains active cycle, not fresh idle start
- [ ] Refresh multiple times quickly (2-3 times)
- [ ] Confirm no state corruption or forced new record

---

## 5) Error Prevention Checks

- [ ] No TypeScript/JS errors in:
  - `frontend/src/components/MobileProduction.tsx`
  - `backend/src/controllers/mobileProductionController.js`
  - `backend/src/app.js`
- [ ] No errors in VS Code Problems panel
- [ ] Browser hard refresh completed after deployment (`Ctrl+F5`)

---

## 6) Operational Safety (Production Impact Control)

- [ ] Feature testing is not running on production backend port `3001`
- [ ] Feature branch and production branch are not mixed in the same run session
- [ ] No unverified changes pushed to live branch without checklist pass

---

## 7) Quick Smoke-Test Script (2 Minutes)

1. Open: `/mobile/<machine>/<employee>`
2. Click `START`
3. Wait 30 seconds
4. Refresh page
5. Verify timer/state restored
6. Click `FINISH`
7. Verify summary/output updated
8. Click `RESET`
9. Verify ready for next cycle

---

## 8) If Something Fails

- [ ] Restart backend (`PORT=3101 npm start`)
- [ ] Verify API URL in `frontend/.env.local`
- [ ] Hard refresh browser (`Ctrl+F5`)
- [ ] Recheck machine/employee existence in masters
- [ ] Re-run section 7 smoke test

---

## 9) Release Gate Recommendation

Do not merge Mobile Production changes unless all of these pass:

- [ ] Runtime setup checks
- [ ] Functional checks
- [ ] Refresh & resilience checks
- [ ] Error prevention checks
