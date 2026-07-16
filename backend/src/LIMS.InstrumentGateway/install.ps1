#Requires -RunAsAdministrator
<#
.SYNOPSIS
    LIMS Instrument Gateway — interactive setup + Windows Service installer.
    Run once on the lab PC. No file editing needed.

.EXAMPLE
    .\install.ps1
    .\install.ps1 -Uninstall
#>

param([switch]$Uninstall)

$ServiceName  = "LIMSInstrumentGateway"
$ServiceLabel = "LIMS Instrument Gateway"
$PublishDir   = "$PSScriptRoot\publish"
$ExePath      = "$PublishDir\LIMS.InstrumentGateway.exe"
$ConfigPath   = "$PublishDir\appsettings.json"

# ── Colours ──────────────────────────────────────────────────────────────────
function Write-Header($t) { Write-Host "`n=== $t ===" -ForegroundColor Cyan }
function Write-OK($t)     { Write-Host "  [OK] $t"   -ForegroundColor Green }
function Write-Warn($t)   { Write-Host "  [!!] $t"   -ForegroundColor Yellow }
function Write-Err($t)    { Write-Host "  [XX] $t"   -ForegroundColor Red }

# ── Uninstall ─────────────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Header "Uninstalling $ServiceLabel"
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        if ($svc.Status -eq 'Running') { Stop-Service $ServiceName -Force }
        sc.exe delete $ServiceName | Out-Null
        Write-OK "Service removed."
    } else {
        Write-Warn "Service not found — nothing to remove."
    }
    exit 0
}

# ── Banner ────────────────────────────────────────────────────────────────────
Clear-Host
Write-Host @"

  ██████  ██   ██  ██████  ██████
  ██   ██ ██   ██ ██      ██
  ██████  ███████ ██      ███████
  ██      ██   ██ ██      ██   ██
  ██      ██   ██  ██████  ██████   Instrument Gateway Setup

"@ -ForegroundColor Cyan

Write-Host "This wizard will configure the gateway and install it as a Windows Service." -ForegroundColor Gray
Write-Host "Press Ctrl+C at any time to cancel.`n" -ForegroundColor Gray

# ── Step 1: Build / publish ───────────────────────────────────────────────────
Write-Header "Step 1 — Build"

$csproj = "$PSScriptRoot\LIMS.InstrumentGateway.csproj"
if (-not (Test-Path $csproj)) {
    # Running from publish dir already — skip build
    Write-OK "Running from published directory — skipping build."
} else {
    Write-Host "  Building release..." -ForegroundColor Gray
    dotnet publish $csproj -c Release -o $PublishDir --nologo -v q 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Err "Build failed. Run: dotnet publish $csproj"; exit 1 }
    Write-OK "Published to $PublishDir"
}

if (-not (Test-Path $ExePath)) { Write-Err "Executable not found: $ExePath"; exit 1 }

# ── Step 2: LIMS API ─────────────────────────────────────────────────────────
Write-Header "Step 2 — LIMS API Connection"

$defaultUrl = "http://localhost:5204"
$apiUrl = Read-Host "  LIMS API URL [$defaultUrl]"
if ([string]::IsNullOrWhiteSpace($apiUrl)) { $apiUrl = $defaultUrl }

$apiUser = Read-Host "  Service account username [instrument.gateway]"
if ([string]::IsNullOrWhiteSpace($apiUser)) { $apiUser = "instrument.gateway" }

$apiPassSec = Read-Host "  Service account password" -AsSecureString
$apiPass    = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
                [Runtime.InteropServices.Marshal]::SecureStringToBSTR($apiPassSec))

# Quick connectivity test
Write-Host "  Testing connection to $apiUrl ..." -ForegroundColor Gray
try {
    $null = Invoke-WebRequest "$apiUrl/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-OK "API reachable."
} catch {
    Write-Warn "Could not reach $apiUrl/health — continuing anyway (API may not expose /health)."
}

# ── Step 3: COM ports ─────────────────────────────────────────────────────────
Write-Header "Step 3 — Instrument COM Ports"

$availablePorts = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object
if ($availablePorts.Count -eq 0) {
    Write-Warn "No COM ports detected. You can add them manually to appsettings.json later."
    $availablePorts = @("COM3")
}

Write-Host "  Available COM ports: $($availablePorts -join ', ')" -ForegroundColor Gray

$instruments = @()
$addMore     = $true
$idx         = 1

while ($addMore) {
    Write-Host "`n  --- Instrument $idx ---" -ForegroundColor White

    $iName = Read-Host "    Instrument name (e.g. Balance-A)"
    if ([string]::IsNullOrWhiteSpace($iName)) { break }

    Write-Host "    Types: GenericAscii | AstmE1394 | Sartorius | Mettler" -ForegroundColor Gray
    $iType = Read-Host "    Instrument type [GenericAscii]"
    if ([string]::IsNullOrWhiteSpace($iType)) { $iType = "GenericAscii" }

    $defaultPort = if ($availablePorts.Count -ge $idx) { $availablePorts[$idx - 1] } else { "COM$($idx + 2)" }
    $iPort = Read-Host "    COM port [$defaultPort]"
    if ([string]::IsNullOrWhiteSpace($iPort)) { $iPort = $defaultPort }

    $iBaud = Read-Host "    Baud rate [9600]"
    if ([string]::IsNullOrWhiteSpace($iBaud)) { $iBaud = "9600" }

    $iParam = Read-Host "    Default parameter name (e.g. 'Acid Value', 'Net Weight')"

    $instruments += [ordered]@{
        Name                = $iName
        InstrumentType      = $iType
        PortName            = $iPort.ToUpper()
        BaudRate            = [int]$iBaud
        DataBits            = 8
        Parity              = "None"
        StopBits            = "One"
        Handshake           = "None"
        Terminator          = "`r`n"
        DefaultParameterName = $iParam
        AutoSubmit          = $true
    }

    $more = Read-Host "`n    Add another instrument? [y/N]"
    $addMore = $more -eq 'y' -or $more -eq 'Y'
    $idx++
}

# ── Step 4: Write appsettings.json ────────────────────────────────────────────
Write-Header "Step 4 — Writing Configuration"

$configObj = [ordered]@{
    Logging = [ordered]@{
        LogLevel = [ordered]@{
            Default                    = "Information"
            "Microsoft.Hosting.Lifetime" = "Information"
        }
    }
    Gateway = [ordered]@{
        LimsApiBaseUrl  = $apiUrl
        ServiceUsername = $apiUser
        ServicePassword = $apiPass
        Instruments     = $instruments
    }
}

$configObj | ConvertTo-Json -Depth 10 | Set-Content $ConfigPath -Encoding UTF8
Write-OK "Configuration written to $ConfigPath"

# ── Step 5: Install Windows Service ───────────────────────────────────────────
Write-Header "Step 5 — Windows Service"

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Warn "Service already exists — updating..."
    if ($existing.Status -eq 'Running') { Stop-Service $ServiceName -Force }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
}

sc.exe create $ServiceName `
    binPath= "`"$ExePath`"" `
    DisplayName= "$ServiceLabel" `
    start= auto | Out-Null

sc.exe description $ServiceName "Reads lab instrument data via RS232/COM ports and posts results to the LIMS API." | Out-Null

$startNow = Read-Host "`n  Start the service now? [Y/n]"
if ($startNow -ne 'n' -and $startNow -ne 'N') {
    Start-Service $ServiceName
    $status = (Get-Service $ServiceName).Status
    if ($status -eq 'Running') {
        Write-OK "Service started — Status: $status"
    } else {
        Write-Warn "Service status: $status. Check Event Viewer for details."
    }
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host "`n"
Write-OK "Setup complete!"
Write-Host @"

  Useful commands:
    Get-Service $ServiceName              # check status
    Stop-Service $ServiceName             # stop
    Start-Service $ServiceName            # start
    .\install.ps1 -Uninstall              # remove service

  Logs:
    Event Viewer → Windows Logs → Application → Source: $ServiceName

  To add more instruments later:
    Edit $ConfigPath
    Restart-Service $ServiceName

"@ -ForegroundColor Gray
