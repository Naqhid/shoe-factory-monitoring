$lines = Get-Content 'backend/src/controllers/productionRoutingController.js'
for ($i=0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'validateHeader') {
        Write-Host (($i+1), ':', $lines[$i])
    }
}