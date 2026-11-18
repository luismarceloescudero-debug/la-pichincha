# Relevo desde la PC (spec 067): lo que corre la tarea programada "La Pichincha relevo PC".
# Releva las tiendas con "relevo": "pc" en tiendas.json (FullH4rd y Katech) y sube relevo-pc/<tienda>.json a la rama
# historial desde un clon de trabajo en %LOCALAPPDATA%\la-pichincha\relevo-historial. La tarea lo corre desde su propio
# clon de main (%LOCALAPPDATA%\la-pichincha\relevo-codigo), que se pone al dia aca con pull --ff-only.
# Sin secretos: usa las credenciales de git que ya tiene la PC.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\relevo-pc.ps1            # como la tarea
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\relevo-pc.ps1 -Forzar    # aunque haya uno reciente
param(
    [switch]$Forzar,
    [double]$SaltarSiMenosDe = 12
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$carpeta = Join-Path $env:LOCALAPPDATA 'la-pichincha'
New-Item -ItemType Directory -Force $carpeta | Out-Null
$log = Join-Path $carpeta 'relevo-pc.log'

# El log no crece sin fin: se queda con las ultimas 2000 lineas.
if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) {
    $cola = Get-Content $log -Tail 2000
    Set-Content -Path $log -Value $cola -Encoding utf8
}

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $python) {
    Add-Content -Path $log -Value "$(Get-Date -Format s) sin python en el PATH" -Encoding utf8
    exit 3
}

$env:PYTHONUTF8 = '1'
$argumentos = @((Join-Path $repo 'relevo_pc.py'), '--publicar')
if (-not $Forzar) { $argumentos += @('--saltar-si-menos-de', "$SaltarSiMenosDe") }

Add-Content -Path $log -Value "`n=== $(Get-Date -Format s) relevo desde la PC ($repo)" -Encoding utf8
Push-Location $repo
try {
    # El clon propio de la tarea (instalar-relevo-pc.ps1) se pone al dia con main; si falla, se releva con lo que hay.
    # Corrido a mano desde otro checkout (el tuyo) no hace pull: ese no se toca.
    if ($repo -eq (Join-Path $carpeta 'relevo-codigo')) {
        cmd /c ('git pull --quiet --ff-only >> "' + $log + '" 2>&1')
    }
    # cmd junta stdout y stderr en el log sin que PowerShell 5.1 convierta stderr en errores.
    $linea = '"' + $python + '" ' + (($argumentos | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' >> "' + $log + '" 2>&1'
    cmd /c $linea
    $codigo = $LASTEXITCODE
} finally {
    Pop-Location
}
Add-Content -Path $log -Value "=== fin, codigo $codigo" -Encoding utf8
exit $codigo
