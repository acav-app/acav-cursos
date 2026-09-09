$lines = Get-Content 'app/[lang]/(dashboard)/(home)/dashboard/page-view.jsx'
for ($idx = 0; $idx -lt 30; $idx++) {
    Write-Output ($idx+1)
    Write-Output $lines[$idx]
}
