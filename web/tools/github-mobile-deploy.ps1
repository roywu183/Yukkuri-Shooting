param([ValidateSet('Create', 'PublishArtifact', 'EnablePages', 'Status')][string]$Mode = 'Status')
$ErrorActionPreference = 'Stop'
$repositoryName = 'Yukkuri-Shooting-Mobile'
$credentialText = "protocol=https`nhost=github.com`n`n" | git credential fill
$credential = @{}
foreach ($line in $credentialText) {
    $pair = $line -split '=', 2
    if ($pair.Count -eq 2) { $credential[$pair[0]] = $pair[1] }
}
if (-not $credential['password']) { throw '沒有可用的 GitHub 登入憑證。' }
$headers = @{
    Authorization = "Bearer $($credential['password'])"
    Accept = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}
$repositoryUrl = "https://api.github.com/repos/roywu183/$repositoryName"
if ($Mode -eq 'Create') {
    try {
        $existing = Invoke-RestMethod -Uri $repositoryUrl -Headers $headers
        throw "儲存庫已存在，請先檢查內容：$($existing.html_url)"
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw }
    }
    $body = @{ name = $repositoryName; description = '加工所：制高點手機支援版，提供直向與橫向觸控操作。'; private = $false; auto_init = $false } | ConvertTo-Json
    Invoke-RestMethod -Method Post -Uri 'https://api.github.com/user/repos' -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body |
        Select-Object full_name, html_url, private | ConvertTo-Json
} elseif ($Mode -eq 'PublishArtifact') {
    # 僅發布建置產物，不上傳原始碼、測試、存檔或憑證。
    $distDirectory = (Resolve-Path (Join-Path $PSScriptRoot '../dist')).Path
    $files = @(Get-ChildItem -LiteralPath $distDirectory -File -Recurse)
    if ($files.Count -ne 4 -or @($files | Where-Object { $_.Extension -notin '.html', '.css', '.js' }).Count) {
        throw '網頁產物清單與預期不符，停止發布。'
    }
    function Publish-File([string]$Path, [byte[]]$Bytes) {
        $payload = @{ message = "發布手機版：$Path"; content = [Convert]::ToBase64String($Bytes); branch = 'main' }
        try {
            $existingFile = Invoke-RestMethod -Uri "$repositoryUrl/contents/${Path}?ref=main" -Headers $headers
            $payload.sha = $existingFile.sha
        } catch { if ($_.Exception.Response.StatusCode.value__ -ne 404) { throw } }
        $body = $payload | ConvertTo-Json
        Invoke-RestMethod -Method Put -Uri "$repositoryUrl/contents/$Path" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body $body | Out-Null
        Write-Output "已發布：$Path"
    }
    Publish-File 'README.md' ([Text.Encoding]::UTF8.GetBytes("# 加工所：制高點手機版`n`n此儲存庫僅包含公開遊戲網頁產物與 GitHub Pages 部署設定。`n`n遊玩：https://roywu183.github.io/Yukkuri-Shooting-Mobile/`n"))
    foreach ($file in $files) {
        $relativePath = $file.FullName.Substring($distDirectory.Length + 1).Replace('\', '/')
        Publish-File $relativePath ([IO.File]::ReadAllBytes($file.FullName))
    }
    Publish-File '.nojekyll' ([byte[]]@())
    $workflow = @'
name: 部署手機版遊戲
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: github-pages
  cancel-in-progress: true
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v4
        with:
          path: '.'
      - uses: actions/deploy-pages@v4
        id: deployment
'@
    Publish-File '.github/workflows/deploy-pages.yml' ([Text.Encoding]::UTF8.GetBytes($workflow))
} elseif ($Mode -eq 'EnablePages') {
    Invoke-RestMethod -Method Patch -Uri $repositoryUrl -Headers $headers -ContentType 'application/json' -Body '{"default_branch":"main"}' | Out-Null
    Invoke-RestMethod -Method Post -Uri "$repositoryUrl/pages" -Headers $headers -ContentType 'application/json' -Body '{"build_type":"workflow","source":{"branch":"main","path":"/"}}' |
        Select-Object html_url, build_type, source | ConvertTo-Json -Depth 3
    Invoke-RestMethod -Method Post -Uri "$repositoryUrl/actions/workflows/deploy-pages.yml/dispatches" -Headers $headers -ContentType 'application/json' -Body '{"ref":"main"}' | Out-Null
    Write-Output '已啟用 Pages 並觸發部署。'
} else {
    $runs = Invoke-RestMethod -Uri "$repositoryUrl/actions/runs?per_page=3" -Headers $headers
    $runs.workflow_runs | Select-Object id, head_sha, status, conclusion, html_url | ConvertTo-Json
}
