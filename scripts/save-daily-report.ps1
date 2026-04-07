<#
Save daily report (JSON or Excel) from a URL to a local folder (for sharing/mapping).

Usage examples:
  powershell -ExecutionPolicy Bypass -File .\scripts\save-daily-report.ps1
  powershell -ExecutionPolicy Bypass -File .\scripts\save-daily-report.ps1 -Url "http://192.168.5.47:3000/reports" -OutputDir "C:\ShoeReports"
  powershell -ExecutionPolicy Bypass -File .\scripts\save-daily-report.ps1 -ExcelUrl "http://192.168.5.47:3000/reports/export.xlsx" -OutputDir "C:\ShoeReports"

Parameters:
  -Url: report URL to fetch (default built for your environment)
  -ExcelUrl: direct XLSX download URL (if the UI provides a direct link)
  -OutputDir: local folder to save backups (default C:\ShoeReports)
  -AddTimestamp: add time to filename to avoid overwrites
  -UseUTC: use UTC date instead of local
  -AuthHeaderName / -AuthHeaderValue: optional single header (e.g. Authorization / "Bearer <token>")
  -Cookie: optional cookie header string to send
#>

param(
    [string]$Url = "http://192.168.5.47:3000/reports",
    [string]$ExcelUrl,
    [string]$OutputDir = "C:\ShoeReports",
    [switch]$AddTimestamp,
    [switch]$UseUTC,
    [string]$AuthHeaderName,
    [string]$AuthHeaderValue,
    [string]$Cookie
)

function New-Headers {
    param($name, $value, $cookie)
    $h = @{}
    if ($name -and $value) { $h[$name] = $value }
    if ($cookie) { $h['Cookie'] = $cookie }
    return $h
}

try {
    if (-not (Test-Path -Path $OutputDir)) {
        New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    }

    $now = Get-Date
    if ($UseUTC) { $now = $now.ToUniversalTime() }
    $datePart = $now.ToString('yyyy-MM-dd')

    $downloadUrl = if ($ExcelUrl) { $ExcelUrl } else { $Url }
    $ext = if ($ExcelUrl) { 'xlsx' } else { 'json' }
    if ($AddTimestamp) { $timePart = $now.ToString('HHmmss'); $fileName = "report-$datePart-$timePart.$ext" }
    else { $fileName = "report-$datePart.$ext" }

    $outPath = Join-Path -Path $OutputDir -ChildPath $fileName

    Write-Output "Fetching $downloadUrl"

    $headers = New-Headers -name $AuthHeaderName -value $AuthHeaderValue -cookie $Cookie
    if ($headers.Keys.Count -gt 0) {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $outPath -Headers $headers -ErrorAction Stop
    }
    else {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $outPath -ErrorAction Stop
    }

    Write-Output "Saved report to: $outPath"
    exit 0
}
catch {
    Write-Error "Failed to fetch or save report: $_"
    exit 2
}
