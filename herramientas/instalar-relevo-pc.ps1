# Registra (o actualiza) la tarea programada del relevo desde la PC (spec 067).
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\instalar-relevo-pc.ps1
#   ... -Hora 05:30          otra hora
#   ... -Desinstalar
# La tarea NO corre desde tu checkout: usa un clon propio de main en %USERPROFILE%\.la-pichincha\relevo-codigo (se crea
# aca la primera vez y relevo-pc.ps1 lo pone al dia con pull --ff-only antes de cada corrida). Asi no depende de que tu
# carpeta este en main ni al dia, y nunca la toca. No va en AppData: Claude de escritorio (MSIX) ve AppData\Local
# virtualizado y la tarea no encontraria el script (0x8007010B, 18/11).
# Diaria a las 05:30 (antes de la publicacion programada de la manana) y al iniciar sesion; si la PC estaba apagada a
# esa hora corre apenas puede (StartWhenAvailable). Solo con red. El script no repite si ya hay un relevo de menos de 12 h.
param(
    [string]$Hora = '05:30',
    [switch]$Desinstalar
)

$ErrorActionPreference = 'Stop'
$nombre = 'La Pichincha relevo PC'

if ($Desinstalar) {
    Unregister-ScheduledTask -TaskName $nombre -Confirm:$false
    Write-Output "Tarea '$nombre' eliminada (el clon en %USERPROFILE%\.la-pichincha queda; borralo a la Papelera si queres)."
    exit 0
}

$origen = Split-Path -Parent $PSScriptRoot
$remoto = (& git -C $origen remote get-url origin).Trim()
$clon = Join-Path $env:USERPROFILE '.la-pichincha\relevo-codigo'
if (-not (Test-Path (Join-Path $clon '.git'))) {
    New-Item -ItemType Directory -Force (Split-Path -Parent $clon) | Out-Null
    & git clone --quiet --depth 1 --branch main --single-branch $remoto $clon
    if ($LASTEXITCODE -ne 0) { throw "no se pudo clonar $remoto" }
}
foreach ($campo in 'user.name', 'user.email') {
    $valor = (& git -C $origen config $campo)
    if ($valor) { & git -C $clon config $campo $valor }
}
$script = Join-Path $clon 'herramientas\relevo-pc.ps1'
if (-not (Test-Path $script)) {
    & git -C $clon pull --quiet --ff-only
    if (-not (Test-Path $script)) { throw "el clon $clon no tiene herramientas\relevo-pc.ps1" }
}
$usuario = "$env:USERDOMAIN\$env:USERNAME"

$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '"')
$disparadores = @(
    (New-ScheduledTaskTrigger -Daily -At $Hora),
    (New-ScheduledTaskTrigger -AtLogOn -User $usuario)
)
$ajustes = New-ScheduledTaskSettingsSet -RunOnlyIfNetworkAvailable -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)
# Solo con la sesion iniciada: git usa las credenciales del usuario (Administrador de credenciales de Windows).
$principal = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $nombre -Action $accion -Trigger $disparadores -Settings $ajustes `
    -Principal $principal -Description 'La Pichincha (spec 067): releva FullH4rd y Katech desde la PC y lo sube a la rama historial.' `
    -Force | Out-Null

$t = Get-ScheduledTask -TaskName $nombre
Write-Output "Tarea '$nombre' registrada: diaria $Hora y al iniciar sesion, solo con red. Estado: $($t.State)"
Write-Output "Script: $script"
Write-Output "Log: $(Join-Path $env:USERPROFILE '.la-pichincha\relevo-pc.log')"
