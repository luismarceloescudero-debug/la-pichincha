# Registra (o actualiza) la tarea programada del relevo desde la PC (spec 067).
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\instalar-relevo-pc.ps1
#   ... -Hora 05:30 -Desinstalar
# La tarea corre herramientas\relevo-pc.ps1 de ESTA carpeta: instalala desde el checkout de main (no desde un worktree).
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
    Write-Output "Tarea '$nombre' eliminada."
    exit 0
}

$script = Join-Path $PSScriptRoot 'relevo-pc.ps1'
$repo = Split-Path -Parent $PSScriptRoot
$usuario = "$env:USERDOMAIN\$env:USERNAME"

$accion = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $script + '"') `
    -WorkingDirectory $repo
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
Write-Output "Log: $(Join-Path $env:LOCALAPPDATA 'la-pichincha\relevo-pc.log')"
