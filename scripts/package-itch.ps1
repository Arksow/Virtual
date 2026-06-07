$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$distPath = Join-Path $projectRoot "dist"
$releasePath = Join-Path $projectRoot "release"
$zipPath = Join-Path $releasePath "racing-arena-itch.zip"

if (!(Test-Path -LiteralPath $distPath)) {
  throw "dist folder not found. Run npm run build:itch first."
}

New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
Remove-Item -LiteralPath $zipPath -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $distPath "*") -DestinationPath $zipPath -Force

Write-Host "Created itch.io upload: $zipPath"
