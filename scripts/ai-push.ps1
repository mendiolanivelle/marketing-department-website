param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Message,

  [switch]$SkipChecks
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command,

    [string[]]$Arguments = @()
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command $($Arguments -join ' ')"
  }
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($repoRoot)) {
  throw "This script must be run inside a git repository."
}

Set-Location $repoRoot

$branch = (& git branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($branch)) {
  throw "Could not determine the current branch."
}

$upstream = & git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
$hasUpstream = $LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($upstream)

$status = git status --porcelain
if (-not $status) {
  if ($hasUpstream) {
    $aheadCount = (& git rev-list --count "$upstream..HEAD").Trim()
    if ($LASTEXITCODE -eq 0 -and [int]$aheadCount -gt 0) {
      Invoke-Checked "git" @("push")
      Write-Host "Pushed $branch to GitHub."
      exit 0
    }
  }

  Write-Host "No local changes or unpushed commits."
  exit 0
}

if (-not $SkipChecks) {
  Invoke-Checked "npm" @("run", "lint")
  Invoke-Checked "npm" @("run", "build")
}

Invoke-Checked "git" @("add", "-A")

$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host "No staged changes to commit."
  exit 0
}

Invoke-Checked "git" @("commit", "-m", $Message)

if ($hasUpstream) {
  Invoke-Checked "git" @("push")
} else {
  Invoke-Checked "git" @("push", "-u", "origin", $branch)
}

Write-Host "Pushed $branch to GitHub."
