What I added

- `scripts/save-daily-report.ps1`: PowerShell script that downloads the report from the configured URL and saves it to a folder using a date-based filename.

How to use

1. Pick an output folder on the report server (example `C:\ShoeReports`) or a network share (example `\\fileserver\ShoeReports`).
2. Share the folder for your managers:
   - Windows: Right-click the folder → Properties → Sharing → Advanced Sharing → Share name (e.g. ShoeReports) → Permissions → Add user/group and grant Read (or Change) as needed.
   - Or use an existing file server/SMB share.
3. Save the script in the repository at `scripts/save-daily-report.ps1` (already added).
4. Run manually to test:
```
powershell -ExecutionPolicy Bypass -File C:\path\to\repo\scripts\save-daily-report.ps1 -Url "http://192.168.5.47:3000/reports" -OutputDir "C:\ShoeReports" -AddTimestamp
# To download the Excel export (if you have a direct link):
powershell -ExecutionPolicy Bypass -File C:\path\to\repo\scripts\save-daily-report.ps1 -ExcelUrl "http://192.168.5.47:3000/reports/export.xlsx" -OutputDir "C:\ShoeReports" -AddTimestamp
```

Scheduling (Windows Task Scheduler)

Create a scheduled task to run daily. Example command (run as admin once):
```
schtasks /create /SC DAILY /TN "SaveDailyReport" /TR "powershell -ExecutionPolicy Bypass -File C:\path\to\repo\scripts\save-daily-report.ps1 -Url 'http://192.168.5.47:3000/reports' -OutputDir 'C:\ShoeReports' -AddTimestamp" /ST 00:05
```
Adjust `/ST` (start time) as required.

Mapping the share on manager PCs

- Using File Explorer: Map Network Drive → provide `\\<server>\ShoeReports` and choose a drive letter.
- Using command line:
```
net use Z: \\server\ShoeReports /persistent:yes
```

Notes and recommendations

- If the server hosting the reports is Linux, you can host the `C:\ShoeReports` folder as an SMB share with Samba and follow the same mapping steps.
- Ensure the account running the scheduled task has write permission to the target folder (and that share permissions allow manager read access).
- If the report endpoint requires authentication, update the script to include credentials or a token (I can add that if needed).
 - If the report endpoint requires authentication, the script supports `-AuthHeaderName` and `-AuthHeaderValue` (for example `-AuthHeaderName Authorization -AuthHeaderValue "Bearer <token>"`) or `-Cookie` to send a cookie string.

Node cron option

1. Install dependencies and start the Node cron job (inside the `scripts` folder):
```powershell
cd C:\Software\shoe-factory-monitoring\scripts
npm install
npm start
```

2. Configure via environment variables or CLI args. Examples:
```powershell
node save-daily-report-node.js --excelUrl "http://192.168.5.47:3000/reports/export.xlsx" --outputDir "C:\Software\shoe-factory-monitoring\scripts\SavedReports" --addTimestamp
```

3. Run as a background service (recommended): use `pm2` or create a Windows service. Example with `pm2`:
```powershell
npm install -g pm2
pm2 start save-daily-report-node.js --name SaveDailyReport
pm2 save
```

This Node option is useful if you prefer a single long-running process handling scheduling, logging, and retries. It can be run on Windows or Linux.

UI automation (Puppeteer) notes

- Use UI mode when the export requires filling the date inputs and clicking an Export button.
- You must provide CSS selectors for the from-date input, to-date input, and the export button.
- Example run (install puppeteer first: `npm install`):
```powershell
node save-daily-report-node.js --ui --url "http://192.168.5.47:3000/reports" --fromSelector "#fromDate" --toSelector "#toDate" --exportSelector ".export-btn" --outputDir "C:\Software\shoe-factory-monitoring\scripts\SavedReports" --addTimestamp
```

The script defaults the date range to yesterday; override with `--fromDate` and `--toDate` if needed.
