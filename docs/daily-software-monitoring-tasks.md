## Daily Software Monitoring Tasks

Purpose: Provide a concise, repeatable daily checklist for software monitoring across multiple production lines. Each production line will have one tab-separated row (a "tab" between columns) so records can be copied into spreadsheets or logs.

How to use:
- Run these checks once at shift start and once mid-shift (or as required).
- Fill one row per line using the template below. Use short values and freeform notes for actions taken.

Per-line tab-separated template (header):

Line	Date	Time	Checker	System Health	Data Flow	APIs	DB Sync	Incoming Files	Processed Files	Logs Checked	Disk Usage	Services Running	Alerts	Action Required	Notes

Example row (tabs between values):

Line-01	2026-04-07	08:15	A. Kumar	OK	OK	OK	OK	3 files	3 files	app.log,db.log	45% used	pm2,node,cloudflared	None	None	All good

Daily checklist (per line):

1. System health
   - Check server CPU, memory and disk usage; ensure no runaway processes.
   - Command examples: `top`/Task Manager, `df -h` or Windows Explorer disk view.

2. Services & processes
   - Verify backend services are running: Node app(s), queue workers, `cloudflared` tunnel (if used), PM2 or systemd units.
   - Restart any failed services and record the reason.

3. Logs
   - Tail or inspect last 24h of relevant logs: backend logs, machine-centre summary logs, incoming/processed handlers.
   - Look for repeated errors, stack traces, or failing API calls.

4. Data flow (incoming -> processing -> processed)
   - Confirm files arrive in `incoming/` for the line and get moved to `processed/` within expected time.
   - Check for backlog or stuck files; inspect `logs/error/` and `logs/` for issues.

5. API & Database checks
   - Ping key API endpoints used by the line; ensure responses are within expected latency.
   - Verify the DB connection and recent writes for the line's records; look for replication lag or failed transactions.

6. Performance & thresholds
   - Check line-specific thresholds: output %, idle minutes, SMV thresholds. Note any breaches and expected cause.

7. Alerts & notifications
   - Review monitoring alerts (if present) and acknowledge or escalate as needed.
   - Record alert ID, time, and action taken in the Notes column.

8. Backup & persistence checks
   - Ensure daily backups or export processes completed (if applicable).

9. Cleanup & housekeeping
   - Trim large logs, free disk if above threshold, and rotate logs if needed.

10. Post-check summary
   - If any issues were found, record an `Action Required` short tag (e.g., `Restart Service`, `Investigate DB`), owner, and ETA in `Notes`.

Escalation and contacts
- Primary: Site IT / Dev on-call (add phone/Slack/email here).
- Secondary: Lead engineer / Operations manager.

Notes and best practices
- Keep entries short — use the tab-separated columns for automated import.
- Save each day’s sheet to a known location (central monitoring folder) for audit and trend analysis.
- If a recurring issue appears on multiple lines, create a dedicated incident ticket and link the IDs in the Notes column.

Optional fields (for teams that track more details)
- `Patch Level`, `Node Version`, `App Commit`, `Restart Count` — add as extra columns to the template if useful.

End of document.
