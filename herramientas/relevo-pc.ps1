# Relevo desde la PC (spec 067): lo que corre la tarea programada "La Pichincha relevo PC".
# Releva las tiendas con "relevo": "pc" en tiendas.json (FullH4rd y Katech) y sube relevo-pc/<tienda>.json a la rama
# historial desde un clon de trabajo en %USERPROFILE%\.la-pichincha\relevo-historial. La tarea lo corre desde su propio
# clon (%USERPROFILE%\.la-pichincha\relevo-codigo), que aca se pasa al ultimo tag relevo-pc-vN; sin tag no corre.
# Sin secretos: usa las credenciales de git que ya tiene la PC.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\relevo-pc.ps1            # como la tarea
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\relevo-pc.ps1 -Forzar    # aunque haya uno reciente
#   powershell -NoProfile -ExecutionPolicy Bypass -File herramientas\relevo-pc.ps1 -SinPublicar  # prueba: deja relevo-pc/ en %TEMP%
param(
    [switch]$Forzar,
    [double]$SaltarSiMenosDe = 12,
    [switch]$SinPublicar
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$carpeta = Join-Path $env:USERPROFILE '.la-pichincha'
New-Item -ItemType Directory -Force $carpeta | Out-Null
$log = Join-Path $carpeta 'relevo-pc.log'
$utf8 = New-Object System.Text.UTF8Encoding $false

# Escribir el log nunca frena el relevo (18/11: un tail -f abierto hacia fallar Add-Content y la tarea no relevaba).
# Se abre compartido (FileShare.ReadWrite) con reintento corto; si aun asi no se puede, se sigue en un log alternativo
# relevo-pc-<fecha-hora>.log de la misma carpeta, y si tampoco, solo por consola.
function Escribir([string]$texto) {
    for ($i = 0; $i -lt 3; $i++) {
        try {
            $f = [System.IO.File]::Open($script:log, 'Append', 'Write', 'ReadWrite')
            try { $b = $utf8.GetBytes($texto + "`r`n"); $f.Write($b, 0, $b.Length) } finally { $f.Dispose() }
            return
        } catch { Start-Sleep -Milliseconds 300 }
    }
    if ($script:log -eq (Join-Path $carpeta 'relevo-pc.log')) {
        $script:log = Join-Path $carpeta ("relevo-pc-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        Escribir $texto
    } else {
        Write-Host $texto
    }
}

# El log no crece sin fin: se queda con las ultimas 2000 lineas (si esta tomado, se recorta otro dia).
try {
    if ((Test-Path $log) -and (Get-Item $log).Length -gt 1MB) {
        $cola = Get-Content $log -Tail 2000
        Set-Content -Path $log -Value $cola -Encoding utf8
    }
} catch { }

$python = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $python) { $python = (Get-Command py -ErrorAction SilentlyContinue).Source }
if (-not $python) {
    Escribir "$(Get-Date -Format s) sin python en el PATH"
    exit 3
}

$env:PYTHONUTF8 = '1'
if ($SinPublicar) {
    $argumentos = @((Join-Path $repo 'relevo_pc.py'), '--salida', (Join-Path $env:TEMP 'relevo-pc-prueba'))
} else {
    $argumentos = @((Join-Path $repo 'relevo_pc.py'), '--publicar')
    if (-not $Forzar) { $argumentos += @('--saltar-si-menos-de', "$SaltarSiMenosDe") }
}

# Antes de los >> de cmd: si el log principal esta tomado, Escribir ya paso al alternativo y cmd usa ese.
Escribir "`r`n=== $(Get-Date -Format s) relevo desde la PC ($repo)"
Push-Location $repo
try {
    # El clon propio de la tarea (instalar-relevo-pc.ps1) corre SOLO el ultimo tag relevo-pc-vN (auditoria 18/11, A1):
    # un commit cualquiera en main no se ejecuta en la PC. El tag se mueve a mano a un commit revisado (spec 067).
    # Sin tag no corre. Corrido a mano desde otro checkout (el tuyo) no cambia de version: ese no se toca.
    if ($repo -eq (Join-Path $carpeta 'relevo-codigo')) {
        cmd /c ('git fetch --quiet --force --depth 1 origin "+refs/tags/relevo-pc-v*:refs/tags/relevo-pc-v*" >> "' + $log + '" 2>&1')
        $tag = (& git tag -l 'relevo-pc-v*' --sort=-v:refname | Select-Object -First 1)
        if (-not $tag) {
            Escribir "$(Get-Date -Format s) sin tag relevo-pc-v*: no corre (spec 067)"
            exit 4
        }
        cmd /c ('git checkout --quiet --force --detach "' + $tag + '" >> "' + $log + '" 2>&1')
        if ($LASTEXITCODE -ne 0) {
            Escribir "$(Get-Date -Format s) no se pudo pasar a $tag`: no corre"
            exit 4
        }
        Escribir "codigo: $tag ($(& git rev-parse --short HEAD))"
    }
    # cmd junta stdout y stderr en el log sin que PowerShell 5.1 convierta stderr en errores.
    $linea = '"' + $python + '" ' + (($argumentos | ForEach-Object { '"' + $_ + '"' }) -join ' ') + ' >> "' + $log + '" 2>&1'
    cmd /c $linea
    $codigo = $LASTEXITCODE
} finally {
    Pop-Location
}
Escribir "=== fin, codigo $codigo"
exit $codigo
