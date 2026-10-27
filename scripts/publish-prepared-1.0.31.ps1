# Run manually in PowerShell from this checkout after reviewing the prepared release.
# Uses the current user's GitHub CLI login; never reads or prints credentials.
$ErrorActionPreference = 'Stop'
$releaseRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $releaseRoot
$sourceRepo = 'rakgoorak/SuperAi-RAKKYXD'
$publicRepo = 'rakgoorak/SuperAi-RAKKYXD-releases'
$expectedHead = 'df398efce616272b5b55ab277ed41667c1b207c6'
$tag = 'v1.0.31'
$utf8 = New-Object System.Text.UTF8Encoding($false)
function Invoke-ReleaseGh {
  param([string[]]$Arguments)
  $result = & gh @Arguments
  if ($LASTEXITCODE -ne 0) { throw "GitHub CLI failed: $($Arguments[0])" }
  return ($result -join "`n")
}
function Write-ReleaseJson {
  param([string]$Name, $Value)
  $file = Join-Path $releaseRoot "output/$Name"
  [System.IO.File]::WriteAllText($file, ($Value | ConvertTo-Json -Depth 100), $utf8)
  return $file
}
function Get-ReleaseHead {
  return (Invoke-ReleaseGh -Arguments @('api', '-H', 'Cache-Control: no-cache', "repos/$sourceRepo/git/ref/heads/main") | ConvertFrom-Json)
}
function Confirm-ReleaseHead {
  param([string]$CommitSha)
  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    $observed = Get-ReleaseHead
    if ($observed.object.sha -eq $CommitSha) { return }
    if ($observed.object.sha -ne $expectedHead) { throw "Remote main moved to $($observed.object.sha); inspect it before continuing." }
    Start-Sleep -Milliseconds 750
  }
  throw "Push verification is still pending for $CommitSha. Run this script again to resume; it will not create another commit."
}
$files = Get-Content -LiteralPath 'output/release-source-payload.json' -Raw -Encoding UTF8 | ConvertFrom-Json
$package = ($files | Where-Object path -eq 'package.json').content | ConvertFrom-Json
if ($package.version -ne '1.0.31') { throw 'Prepared source version is not 1.0.31.' }
$assets = @('SuperAi-RAKKYXD-Setup.exe', 'SuperAi-RAKKYXD-Setup.exe.sha256', 'SuperAi-RAKKYXD-windows-x64.zip', 'SuperAi-RAKKYXD-windows-x64.zip.sha256')
foreach ($asset in $assets) {
  if (-not (Test-Path -LiteralPath "release-assets/$asset")) { throw "Missing asset: $asset" }
}
foreach ($asset in @($assets[0], $assets[2])) {
  $actual = (Get-FileHash -LiteralPath "release-assets/$asset" -Algorithm SHA256).Hash.ToLowerInvariant()
  $expected = ((Get-Content -LiteralPath "release-assets/$asset.sha256" -Raw).Trim() -split '\s+')[0]
  if ($actual -ne $expected) { throw "Checksum mismatch: $asset" }
}
$manifest = Get-Content -LiteralPath 'output/release-manifest.json' -Raw | ConvertFrom-Json
if ($manifest.version -ne '1.0.31') { throw 'Packaged app version is not 1.0.31.' }
# Existing drafts may be resumed; a published release is never overwritten.
$releases = Invoke-ReleaseGh -Arguments @('api', "repos/$publicRepo/releases?per_page=100") | ConvertFrom-Json
$existingRelease = $releases | Where-Object tag_name -eq $tag
if ($existingRelease -and -not $existingRelease.draft) { throw 'v1.0.31 is already published; it will not be overwritten.' }
$head = Get-ReleaseHead
$savedRefPath = Join-Path $releaseRoot 'output/publish-ref-1.0.31.json'
$savedCommitPath = Join-Path $releaseRoot 'output/publish-commit-1.0.31.json'
$commit = $null
if ((Test-Path -LiteralPath $savedRefPath) -and (Test-Path -LiteralPath $savedCommitPath)) {
  $savedRef = Get-Content -LiteralPath $savedRefPath -Raw | ConvertFrom-Json
  $savedCommit = Get-Content -LiteralPath $savedCommitPath -Raw | ConvertFrom-Json
  if ($head.object.sha -eq $savedRef.sha -or $head.object.sha -eq $expectedHead) {
    $candidate = Invoke-ReleaseGh -Arguments @('api', "repos/$sourceRepo/git/commits/$($savedRef.sha)") | ConvertFrom-Json
    if ($candidate.tree.sha -ne $savedCommit.tree -or $candidate.parents[0].sha -ne $expectedHead) { throw 'Saved source commit does not match the prepared release.' }
    $commit = $candidate
    Write-Host "Resuming the existing source commit: $($commit.sha)"
    if ($head.object.sha -eq $expectedHead) {
      $null = Invoke-ReleaseGh -Arguments @('api', '--method', 'PATCH', "repos/$sourceRepo/git/refs/heads/main", '--input', $savedRefPath)
    }
  }
}
if (-not $commit) {
if ($head.object.sha -ne $expectedHead) { throw 'Remote main changed. Stop and integrate its new changes before publishing.' }
$parent = Invoke-ReleaseGh -Arguments @('api', "repos/$sourceRepo/git/commits/$expectedHead") | ConvertFrom-Json
$treeFile = Write-ReleaseJson -Name 'publish-tree-1.0.31.json' -Value @{ base_tree = $parent.tree.sha; tree = @($files) }
$tree = Invoke-ReleaseGh -Arguments @('api', '--method', 'POST', "repos/$sourceRepo/git/trees", '--input', $treeFile) | ConvertFrom-Json
$commitFile = Write-ReleaseJson -Name 'publish-commit-1.0.31.json' -Value @{ message = 'Release v1.0.31: compact composer and refreshed provider model catalogs'; tree = $tree.sha; parents = @($expectedHead) }
$commit = Invoke-ReleaseGh -Arguments @('api', '--method', 'POST', "repos/$sourceRepo/git/commits", '--input', $commitFile) | ConvertFrom-Json
$refFile = Write-ReleaseJson -Name 'publish-ref-1.0.31.json' -Value @{ sha = $commit.sha; force = $false }
$null = Invoke-ReleaseGh -Arguments @('api', '--method', 'PATCH', "repos/$sourceRepo/git/refs/heads/main", '--input', $refFile)
}
Confirm-ReleaseHead -CommitSha $commit.sha
Write-Host "Private source pushed: $($commit.sha)"
$notes = Get-Content -LiteralPath 'output/release-notes-1.0.31.md' -Raw -Encoding UTF8
$notes += "`n`nSource commit: $($commit.sha)`n"
$notesFile = Join-Path $releaseRoot 'output/publish-notes-1.0.31.md'
[System.IO.File]::WriteAllText($notesFile, $notes, $utf8)
if ($existingRelease) {
  if (-not $existingRelease.body.Contains("Source commit: $($commit.sha)")) { throw 'Existing draft belongs to a different source commit; inspect it before continuing.' }
} else {
  $null = Invoke-ReleaseGh -Arguments @('release', 'create', $tag, '--repo', $publicRepo, '--target', 'main', '--draft', '--title', 'SuperAi & RAKKYXD v1.0.31', '--notes-file', $notesFile)
}
$uploadArguments = @('release', 'upload', $tag, '--repo', $publicRepo, '--clobber') + @($assets | ForEach-Object { "release-assets/$_" })
$null = Invoke-ReleaseGh -Arguments $uploadArguments
$draft = Invoke-ReleaseGh -Arguments @('api', "repos/$publicRepo/releases/tags/$tag") | ConvertFrom-Json
foreach ($asset in $assets) {
  $remote = $draft.assets | Where-Object name -eq $asset
  if (-not $remote -or $remote.state -ne 'uploaded' -or $remote.size -ne (Get-Item -LiteralPath "release-assets/$asset").Length) { throw "Uploaded asset verification failed: $asset" }
}
$null = Invoke-ReleaseGh -Arguments @('release', 'edit', $tag, '--repo', $publicRepo, '--draft=false', '--latest')
$latest = Invoke-ReleaseGh -Arguments @('api', "repos/$publicRepo/releases/latest") | ConvertFrom-Json
if ($latest.tag_name -ne $tag -or $latest.draft -or $latest.prerelease) { throw 'Latest public release verification failed.' }
Write-Host "Published and verified: $($latest.html_url)"
