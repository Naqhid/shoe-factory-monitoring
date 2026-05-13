# Run ON the PC where mysqld is installed (e.g. 192.168.5.47).
# Connects to MySQL on 127.0.0.1; reads app user/password/db from backend\.env.
# Grants that user from $ClientHostname (default DESKTOP-SHANKV7).

param(
    [string]$ClientHostname = 'DESKTOP-SHANKV7'
)

$ErrorActionPreference = 'Stop'
$backendRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $backendRoot '.env'

if (-not (Test-Path $envPath)) {
    Write-Error "Missing .env at $envPath (copy backend\.env onto this server if needed)."
}

function Get-DotEnvValue([string]$key) {
    Get-Content $envPath | ForEach-Object {
        if ($_ -match "^\s*$key\s*=\s*(.*)\s*$") {
            return $Matches[1].Trim()
        }
    }
    return $null
}

$dbUser = Get-DotEnvValue 'DB_USER'
if (-not $dbUser) { $dbUser = 'root' }
$dbPass = Get-DotEnvValue 'DB_PASSWORD'
if ($null -eq $dbPass) { $dbPass = '' }
$dbName = Get-DotEnvValue 'DB_NAME'
if (-not $dbName) { $dbName = 'florence' }
$dbPort = Get-DotEnvValue 'DB_PORT'
if (-not $dbPort) { $dbPort = '3306' }

function Escape-SqlLiteral([string]$s) {
    return $s.Replace('\', '\\').Replace("'", "''")
}

$mysql = $null
foreach ($c in @(
        "${env:ProgramFiles}\MySQL\MySQL Server 8.4\bin\mysql.exe",
        "${env:ProgramFiles}\MySQL\MySQL Server 8.0\bin\mysql.exe",
        "${env:ProgramFiles}\MySQL\MySQL Server 5.7\bin\mysql.exe",
        "${env:ProgramFiles}\MariaDB 10.11\bin\mysql.exe",
        "${env:ProgramFiles}\MariaDB 10.6\bin\mysql.exe"
    )) {
    if (Test-Path $c) { $mysql = $c; break }
}
if (-not $mysql) {
    $fromPath = (Get-Command mysql -ErrorAction SilentlyContinue).Source
    if ($fromPath) { $mysql = $fromPath }
}
if (-not $mysql) {
    Write-Error "mysql.exe not found. Install MySQL or add mysql to PATH on this machine."
}

$rootPw = Read-Host -AsSecureString "MySQL root password on THIS machine (127.0.0.1)"
$BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($rootPw)
try {
    $rootPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}
finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)
}

$u = Escape-SqlLiteral $dbUser
$passSql = Escape-SqlLiteral $dbPass
$h = Escape-SqlLiteral $ClientHostname
$dbTick = '`' + ($dbName -replace '`', '``') + '`'

$sql = @"
CREATE USER IF NOT EXISTS '$u'@'$h' IDENTIFIED BY '$passSql';
GRANT ALL PRIVILEGES ON $dbTick.* TO '$u'@'$h';
FLUSH PRIVILEGES;
"@

$env:MYSQL_PWD = $rootPlain
try {
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $mysql
    $psi.Arguments = "-u root --protocol=TCP -h 127.0.0.1 -P $dbPort"
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    $proc.StandardInput.Write($sql)
    $proc.StandardInput.Close()
    $out = $proc.StandardOutput.ReadToEnd()
    $err = $proc.StandardError.ReadToEnd()
    $proc.WaitForExit()
    if ($proc.ExitCode -ne 0) {
        if ($out) { Write-Host $out }
        Write-Error "mysql failed (exit $($proc.ExitCode)): $err"
    }
}
finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}

Write-Host "Done. From $ClientHostname run: npm run restore-db"
