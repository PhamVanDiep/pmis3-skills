# Smoke test thủ công cho azdo.ps1 (không chạy trong CI). Chỉ đọc + chạy khô, KHÔNG ghi thật.
# Dùng:  powershell -NoProfile -File tests/ps1-smoke.ps1 [-WorkDir <thư mục cha không phải git repo>] [-ItemId <id work item KTAT>]
param(
    [string]$WorkDir = (Get-Location).Path,
    [string]$ItemId = ''
)
$ErrorActionPreference = 'Continue'
$script = Join-Path (Split-Path -Parent $PSScriptRoot) 'azdo.ps1'
$env:AZDO_PROJECT = 'KTAT'
Set-Location $WorkDir

Write-Output "=== whoami (mong đợi: Project (repo): KTAT) ==="
& powershell -NoProfile -File $script whoami
Write-Output "=== mine ==="
& powershell -NoProfile -File $script mine
if ($ItemId) {
    Write-Output "=== finish $ItemId (chạy khô, không -Yes) ==="
    & powershell -NoProfile -File $script finish $ItemId
    Write-Output "exit=$LASTEXITCODE"
}
else {
    Write-Output "(bỏ qua finish: truyền -ItemId <id KTAT>)"
}
