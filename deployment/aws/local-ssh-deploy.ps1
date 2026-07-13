param(
  [Parameter(Mandatory = $true)]
  [string]$Ec2Host,

  [string]$KeyPath = ".\autopartscrm.pem",
  [string]$Ec2User = "ec2-user",
  [string]$AppPublicUrl = ""
)

$ErrorActionPreference = "Stop"

function ConvertTo-ShellSingleQuoted {
  param([string]$Value)

  return "'" + $Value.Replace("'", "'`"`"'`"`"'") + "'"
}

function Get-EnvironmentValueOrDefault {
  param(
    [string]$Name,
    [string]$DefaultValue
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return $value
}

if (-not (Test-Path -LiteralPath $KeyPath)) {
  throw "Key file not found: $KeyPath"
}

if ([string]::IsNullOrWhiteSpace($AppPublicUrl)) {
  $AppPublicUrl = "http://$Ec2Host"
}

$requiredEnvironmentVariables = @("DATABASE_URL", "JWT_SECRET", "SEED_USER_PASSWORD")
foreach ($name in $requiredEnvironmentVariables) {
  if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
    throw "Set the $name environment variable before running this script."
  }
}

$remoteTarget = "$Ec2User@$Ec2Host"
$remoteDir = "/tmp/auto-parts-crm-deploy"
$localScripts = @(
  "deployment\aws\setup-amazon-linux-2023.sh",
  "deployment\aws\deploy-app.sh"
)

Write-Host "Checking SSH access to $remoteTarget"
ssh -i $KeyPath $remoteTarget "uname -a"

Write-Host "Copying deployment scripts"
ssh -i $KeyPath $remoteTarget "mkdir -p $remoteDir"
foreach ($script in $localScripts) {
  scp -i $KeyPath $script "${remoteTarget}:$remoteDir/"
}

$envFile = New-TemporaryFile
try {
  $environment = [ordered]@{
    APP_PUBLIC_URL = $AppPublicUrl
    DATABASE_URL = [Environment]::GetEnvironmentVariable("DATABASE_URL")
    JWT_SECRET = [Environment]::GetEnvironmentVariable("JWT_SECRET")
    SEED_USER_PASSWORD = [Environment]::GetEnvironmentVariable("SEED_USER_PASSWORD")
    REDIS_HOST = Get-EnvironmentValueOrDefault "REDIS_HOST" "crm-wjf4r8.serverless.apse2.cache.amazonaws.com"
    REDIS_PORT = Get-EnvironmentValueOrDefault "REDIS_PORT" "6379"
    REDIS_TLS_ENABLED = Get-EnvironmentValueOrDefault "REDIS_TLS_ENABLED" "true"
    RUN_PRISMA_SEED = Get-EnvironmentValueOrDefault "RUN_PRISMA_SEED" "false"
    APP_BASE_URL = Get-EnvironmentValueOrDefault "APP_BASE_URL" $AppPublicUrl
    INVOICE_SIGNING_TOKEN_TTL_DAYS = Get-EnvironmentValueOrDefault "INVOICE_SIGNING_TOKEN_TTL_DAYS" "30"
    SMTP_HOST = Get-EnvironmentValueOrDefault "SMTP_HOST" ""
    SMTP_PORT = Get-EnvironmentValueOrDefault "SMTP_PORT" "587"
    SMTP_USER = Get-EnvironmentValueOrDefault "SMTP_USER" ""
    SMTP_PASS = Get-EnvironmentValueOrDefault "SMTP_PASS" ""
    MAIL_FROM = Get-EnvironmentValueOrDefault "MAIL_FROM" "MEE Auto Parts Billing <billing@meeautoparts.com>"
  }

  $envContent = foreach ($entry in $environment.GetEnumerator()) {
    "export $($entry.Key)=$(ConvertTo-ShellSingleQuoted $entry.Value)"
  }

  [System.IO.File]::WriteAllText(
    $envFile.FullName,
    (($envContent -join "`n") + "`n"),
    [System.Text.Encoding]::ASCII
  )
  scp -i $KeyPath $envFile "${remoteTarget}:$remoteDir/env.sh"
}
finally {
  Remove-Item -LiteralPath $envFile -Force -ErrorAction SilentlyContinue
}

Write-Host "Running remote deployment"
$remoteDeployCommand = "chmod +x $remoteDir/*.sh && sudo $remoteDir/setup-amazon-linux-2023.sh && bash -lc 'source $remoteDir/env.sh; $remoteDir/deploy-app.sh'"
ssh -i $KeyPath $remoteTarget $remoteDeployCommand

$deployExitCode = $LASTEXITCODE
ssh -i $KeyPath $remoteTarget "rm -f $remoteDir/env.sh"

if ($deployExitCode -ne 0) {
  throw "Remote deployment failed with exit code $deployExitCode."
}
