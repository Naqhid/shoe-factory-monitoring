## Daily Software Monitoring Tasks

Purpose: concise, repeatable daily checklist for monitoring software across multiple production lines. Each active line gets one tab-separated row so records can be pasted into spreadsheets or logs.

🎯 Recommended line monitoring frequency

🌅 1) Morning line check → DAILY (most important)

Visit each active line once in the morning.

Time: 15–30 mins total (per full round for ~6 lines)

Check (physical or remote as applicable):
- tablets ON and shortcuts present
- ProdPulse shortcut / app reachable
- line assigned correctly in planner
- Wi‑Fi / LAN reachable and stable
- TV dashboard live and showing current data
- planner screen active and shift reset done
- supervisor login OK
- tablets charging / cables present
- tablet mount and charger secure
- any frozen or unresponsive screens

Why: prevents full-day issues and gives early warning of systemic problems.

🕛 2) Mid-shift quick check → ONCE (recommended)

Around lunch / middle of shift. Quick 10–15 mins round.

Quick checks:
- hourly output updating on dashboards
- tablets still responsive and charging
- any screen frozen or operator on wrong tab
- line target mismatches or planner desync
- report generation/export working
- queued/incoming files being processed

🌆 3) End-of-day report validation → DAILY

No need to visit the line physically unless indicated. Check from PC/server.

Validate:
- all lines sent data for the day
- no missing hours in machine summaries
- report export completed and stored
- planner totals match reported production
- shared folder / archive updated (TV/exports)
- TV dashboard data archived if required

🚨 4) On-demand visit → ONLY when issue requires

Visit physically only if:
- tablet dead or unresponsive
- charger or mount broken
- TV blank or showing wrong data
- Wi‑Fi/LAN outage localized to line
- line wrong mapping in system
- operator reports data not saving
- scanner / barcode reader fails

If physical visit occurs, record root cause and corrective action in `Notes`.

📊 Practical frequency for 6 lines (example)

For Florence (6 lines):
- Morning full round → once daily
- Mid-shift quick round → once daily
- End-of-day validation → once daily
- On-demand visits → as needed

🚀 As system stabilizes

After ~2–3 weeks of stable usage you may reduce physical visits to:
- Morning round only + on-demand visits

⭐ My concise recommendation

- ✅ Morning full line round once daily
- ✅ One quick mid-shift check
- ✅ Rest remote monitoring from PC/server
- ✅ Physical visit only on issue

This balances system ownership with avoiding being the floor support person.

Per-line tab-separated template (header)

Line	Date	Time	Checker	CheckType	SystemHealth	Tablets	Charging	Planner	TV	Network	APIs	DB	Incoming	Processed	Logs	Disk	Services	Alerts	ActionRequired	Notes

Example row:

Line-01	2026-04-07	08:15	A. Kumar	Morning	OK	ON	Yes	Assigned	Live	OK	OK	OK	2 files	2 files	app.log,db.log	45% used	pm2,node,cloudflared	None	Restart Service	Tablet mount loose, replaced

Additional checks to include (missing items added):
- Device health: battery %, charging status, overheating
- App version / Node version / App commit (for debugging)
- PM2 / systemd service status and restart counts
- `cloudflared` tunnel or VPN connectivity
- File processing queue lengths and backlogs
- Recent errors from `logs/error/` and exception counts
- Disk space and inode availability
- Time sync / NTP drift on devices and server
- SSL cert expiry and connection issues for HTTPS endpoints
- DB replication lag or failed transactions
- Scheduled task status (cron, Windows Task Scheduler)
- Backup/export completion and location
- Scanner / barcode reader status and connectivity

Escalation & contacts (fill with your team details)
- Primary: Site IT / Dev on-call — [name / phone / Slack]
- Secondary: Lead engineer — [name / phone / Slack]
- Ops manager — [name / phone / Slack]

Best practices
- Record short entries; keep the tab-separated row for easy import.
- Keep a central daily folder for logs and CSV exports for trend analysis.
- If the same issue repeats across multiple lines, create an incident ticket and reference it in `Notes`.
- Consider automating repetitive server checks (disk, services, API pings) and surfacing results to the morning checklist.

Optional columns (add if you want more telemetry):
- PatchLevel	NodeVersion	AppCommit	RestartCount	BatteryPct	TabletModel

If you want, I can:
- add contact details into this doc,
- generate a simple CSV header + sample import/export script,
- or create a one-page printable checklist for floor supervisors.

End of document.
