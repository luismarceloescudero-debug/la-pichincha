# Relevo desde la PC (spec 067): lo que corre la tarea programada "La Pichincha relevo PC".
# Releva las tiendas con "relevo": "pc" en tiendas.json (FullH4rd y Katech) y sube relevo-pc/<tienda>.json a la rama
# historial desde un clon de trabajo en %USERPROFILE%\.la-pichincha\relevo-historial. La tarea lo corre desde su propio
# clon (%USERPROFILE%\.la-pichincha\relevo-codigo), que aca se pasa al ultimo tag relevo-pc-vN; sin tag no corre.
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
$carpeta = Join-Path $env:USERPROFILE '.la-pichincha'
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
    # El clon propio de la tarea (instalar-relevo-pc.ps1) corre SOLO el ultimo tag relevo-pc-vN (auditoria 18/11, A1):
    # un commit cualquiera en main no se ejecuta en la PC. El tag se mueve a mano a un commit revisado (spec 067).
    # Sin tag no corre. Corrido a mano desde otro checkout (el tuyo) no cambia de version: ese no se toca.
    if ($repo -eq (Join-Path $carpeta 'relevo-codigo')) {
        cmd /c ('git fetch --quiet --force --depth 1 origin "+refs/tags/relevo-pc-v*:refs/tags/relevo-pc-v*" >> "' + $log + '" 2>&1')
        $tag = (& git tag -l 'relevo-pc-v*' --sort=-v:refname | Select-Object -First 1)
        if (-not $tag) {
            Add-Content -Path $log -Value "$(Get-Date -Format s) sin tag relevo-pc-v*: no corre (spec 067)" -Encoding utf8
            exit 4
        }
        cmd /c ('git checkout --quiet --force --detach "' + $tag + '" >> "' + $log + '" 2>&1')
        if ($LASTEXITCODE -ne 0) {
            Add-Content -Path $log -Value "$(Get-Date -Format s) no se pudo pasar a $tag`: no corre" -Encoding utf8
            exit 4
        }
        Add-Content -Path $log -Value "codigo: $tag ($(& git rev-parse --short HEAD))" -Encoding utf8
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
