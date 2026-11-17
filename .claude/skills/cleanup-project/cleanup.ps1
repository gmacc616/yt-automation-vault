# Recycle a finished video project's leftovers plus junk that no future project reuses.
# Never touches anything the workflow needs again (tools, models, browser, fonts, npx/npm caches).
# Dry run by default (lists targets + sizes); pass -Go to actually recycle.
#   -Paths  project-specific items (job dir, render project, downloaded source)
param(
  [string[]]$Paths = @(),
  [switch]$Go
)
Add-Type -AssemblyName Microsoft.VisualBasic

function SizeMB($p) {
  if (Test-Path $p -PathType Leaf) { return [math]::Round((Get-Item $p).Length / 1MB) }
  $s = (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  return [math]::Round(($s + 0) / 1MB)
}

$targets = @()

# 1. The finished project's own files.
foreach ($p in $Paths) { if ($p -and (Test-Path $p)) { $targets += (Resolve-Path $p).Path } else { Write-Output "missing (skipped): $p" } }

# 2. Per-render junk, never reused by a later project:
#    - extracted video frames (one hfcache folder per rendered clip, keyed to that clip's source)
#    - render scratch folders
#    - throwaway browser profiles created each time HyperFrames launches the browser
#    - npm debug logs
$fc = Join-Path $env:TEMP "hyperframes-extract-cache-u"
if (Test-Path $fc) { $targets += $fc }
foreach ($pat in @("hf-render-*", "puppeteer_dev_chrome_profile-*")) {
  Get-ChildItem $env:TEMP -Directory -Filter $pat -Force -ErrorAction SilentlyContinue | ForEach-Object { $targets += $_.FullName }
}
$logs = Join-Path $env:LOCALAPPDATA "npm-cache\_logs"
Get-ChildItem $logs -File -ErrorAction SilentlyContinue | ForEach-Object { $targets += $_.FullName }

# Needed by every project. Never recycled, even if passed in -Paths.
$keep = @(
  "\output", "\tools", "\.claude\skills", "\.agents", "AutoEditor",
  "\.cache\hyperframes",          # render browser + fonts (re-download is slow and SAC-sensitive)
  "\.cache\huggingface",          # Whisper models
  "\npm-cache\_npx",              # installed HyperFrames versions (all kept, so no reinstall)
  "\npm-cache\_cacache"           # npm package cache used by npx
)

$total = 0; $n = 0
foreach ($t in $targets) {
  if ($keep | Where-Object { $t -like "*$_*" }) { Write-Output "KEPT (needed by workflow): $t"; continue }
  $mb = SizeMB $t
  if (-not $Go) { Write-Output ("would recycle {0,6} MB  {1}" -f $mb, $t); $total += $mb; $n++; continue }
  try {
    if (Test-Path $t -PathType Leaf) { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($t, 'OnlyErrorDialogs', 'SendToRecycleBin') }
    else { [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($t, 'OnlyErrorDialogs', 'SendToRecycleBin') }
    Write-Output ("recycled {0,6} MB  {1}" -f $mb, $t); $total += $mb; $n++
  } catch { Write-Output "SKIPPED (in use?) $t : $($_.Exception.Message)" }
}

$kept = 0
foreach ($k in @((Join-Path $env:USERPROFILE ".cache\hyperframes"), (Join-Path $env:LOCALAPPDATA "npm-cache"), (Join-Path $env:USERPROFILE ".cache\huggingface"))) { if (Test-Path $k) { $kept += SizeMB $k } }
Write-Output ("TOTAL {0} {1} items, {2} MB | workflow cache kept: {3} MB" -f ($(if ($Go) { "recycled" } else { "would recycle" })), $n, $total, $kept)
