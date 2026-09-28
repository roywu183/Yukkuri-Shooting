param([ValidateSet('Create', 'EnablePages', 'Status')][string]$Mode = 'Status')
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
