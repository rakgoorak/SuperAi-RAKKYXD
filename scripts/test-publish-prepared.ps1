# Offline replay: no GitHub commands or network requests are executed.
$ErrorActionPreference = 'Stop'
$originalLocation = Get-Location
$fixtureRoot = Join-Path (Split-Path -Parent $PSScriptRoot) ('output/publish-replay-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path "$fixtureRoot/scripts", "$fixtureRoot/output", "$fixtureRoot/release-assets" -Force | Out-Null
Copy-Item -LiteralPath "$PSScriptRoot/publish-prepared-1.0.31.ps1" -Destination "$fixtureRoot/scripts/publish-prepared-1.0.31.ps1"
$encoding = New-Object System.Text.UTF8Encoding($false)
function Write-FixtureJson($Path, $Value) { [IO.File]::WriteAllText($Path, ($Value | ConvertTo-Json -Depth 20), $encoding) }
$global:replaySha = '433c53b8674238012919fbadae09b93f7bb365fd'
$global:replayParent = 'df398efce616272b5b55ab277ed41667c1b207c6'
$global:replayTree = '5319f70e9a4d2f5792549abe929ff7f3fa61bd16'
$global:replayReads = 0
$global:replayActions = @()
$global:replayAssets = @('SuperAi-RAKKYXD-Setup.exe', 'SuperAi-RAKKYXD-Setup.exe.sha256', 'SuperAi-RAKKYXD-windows-x64.zip', 'SuperAi-RAKKYXD-windows-x64.zip.sha256')
$global:replayRoot = $fixtureRoot
Write-FixtureJson "$fixtureRoot/output/release-source-payload.json" @(@{path='package.json';content='{"version":"1.0.31"}'})
Write-FixtureJson "$fixtureRoot/output/release-manifest.json" @{version='1.0.31'}
Write-FixtureJson "$fixtureRoot/output/publish-ref-1.0.31.json" @{sha=$replaySha;force=$false}
Write-FixtureJson "$fixtureRoot/output/publish-commit-1.0.31.json" @{tree=$replayTree;parents=@($replayParent)}
[IO.File]::WriteAllText("$fixtureRoot/output/release-notes-1.0.31.md", 'Offline fixture', $encoding)
foreach ($name in @($replayAssets[0], $replayAssets[2])) {
  [IO.File]::WriteAllText("$fixtureRoot/release-assets/$name", 'test', $encoding)
  $digest = (Get-FileHash -LiteralPath "$fixtureRoot/release-assets/$name" -Algorithm SHA256).Hash.ToLowerInvariant()
  [IO.File]::WriteAllText("$fixtureRoot/release-assets/$name.sha256", "$digest  $name`n", $encoding)
}
function global:gh {
  $commandArgs = @($args)
  $global:LASTEXITCODE = 0
  $route = $commandArgs | Where-Object { $_ -like 'repos/*' } | Select-Object -First 1
  if ($commandArgs[0] -eq 'release') {
    $global:replayActions += $commandArgs[1]
    return ''
  }
  if ($commandArgs -contains '--method') { throw 'Replay must never create or patch the existing source commit.' }
  if ($route -like '*/releases?per_page=*') { return '[]' }
  if ($route -like '*/git/ref/heads/main') {
    $global:replayReads++
    $sha = if ($global:replayReads -eq 2) { $global:replayParent } else { $global:replaySha }
    return (@{object=@{sha=$sha}} | ConvertTo-Json -Depth 10)
  }
  if ($route -like '*/git/commits/*') { return (@{sha=$global:replaySha;tree=@{sha=$global:replayTree};parents=@(@{sha=$global:replayParent})} | ConvertTo-Json -Depth 10) }
  if ($route -like '*/releases/tags/*') {
    return (@{assets=@($global:replayAssets | ForEach-Object { @{name=$_;state='uploaded';size=(Get-Item -LiteralPath "$global:replayRoot/release-assets/$_").Length} })} | ConvertTo-Json -Depth 10)
  }
  if ($route -like '*/releases/latest') { return '{"tag_name":"v1.0.31","draft":false,"prerelease":false,"html_url":"offline-replay"}' }
  throw "Unexpected offline command: $route"
}
try {
  & "$fixtureRoot/scripts/publish-prepared-1.0.31.ps1"
  if ($global:replayReads -ne 3) { throw 'Stale verification response was not retried.' }
  if (($global:replayActions -join ',') -ne 'create,upload,edit') { throw 'Public release continuation did not complete in order.' }
  Write-Output 'PASS: resumes existing source commit, retries a stale verification response, and continues public publication without creating another commit (offline mock).'
} finally {
  Set-Location -LiteralPath $originalLocation.Path
  Remove-Item -LiteralPath Function:/gh -ErrorAction SilentlyContinue
}
