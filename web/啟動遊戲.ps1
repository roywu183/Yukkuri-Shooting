param([switch]$NoOpen)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $nodeCommand) { throw '請先安裝 Node.js 22 或更新版本，然後重新執行。' }
if (-not (Test-Path -LiteralPath "$PSScriptRoot/node_modules/vite/bin/vite.js")) {
    Write-Host '首次啟動：安裝已鎖定版本的套件…'
    & npm.cmd ci --cache "$PSScriptRoot/.npm-cache" --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw '套件安裝失敗。' }
}
if (-not (Test-Path -LiteralPath "$PSScriptRoot/dist/index.html")) {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw '遊戲建置失敗。' }
}
$gameUrl = 'http://127.0.0.1:4173/'
$ready = $false
try {
    $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 2
    if ($response.Content -notmatch '#132f31' -or $response.Content -notmatch 'assets/index-') { throw '連接埠 4173 已被其他程式使用。' }
    $ready = $true
} catch [System.Net.WebException] { }
if (-not $ready) {
    New-Item -ItemType Directory -Force -Path "$PSScriptRoot/.runtime" | Out-Null
    $serverArgs = @("`"$PSScriptRoot/node_modules/vite/bin/vite.js`"", 'preview', '--configLoader', 'native', '--host', '127.0.0.1', '--port', '4173', '--strictPort')
    $process = Start-Process -FilePath $nodeCommand.Source -ArgumentList $serverArgs -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot/.runtime/server.log" -RedirectStandardError "$PSScriptRoot/.runtime/server-error.log" -PassThru
    $process.Id | Set-Content -LiteralPath "$PSScriptRoot/.runtime/server.pid"
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        try { $response = Invoke-WebRequest -Uri $gameUrl -UseBasicParsing -TimeoutSec 1; if ($response.Content -match '#132f31' -and $response.Content -match 'assets/index-') { $ready = $true; break } } catch { }
        if ($process.HasExited) { break }
    }
    if (-not $ready) { throw '遊戲伺服器未能啟動，請查看 web/.runtime/server-error.log。' }
}
Write-Host "遊戲已啟動：$gameUrl"
Write-Host '進度儲存在此瀏覽器；下次請使用相同瀏覽器及網址。'
if (-not $NoOpen) { Start-Process $gameUrl }
