# Copia de respaldo de La Pichincha (25/11, consejo de Opus). Sin secretos: no copia .env ni tokens.
# Uso:   powershell -File herramientas\respaldo.ps1 [-Destino <carpeta>] [-Extra <carpeta>] [-Probar]
#   -Destino  donde se guardan las copias (por defecto OneDrive\respaldo-pichincha, o Documentos si no hay OneDrive)
#   -Extra    segunda carpeta (pendrive, Google Drive de escritorio): se copia lo mismo
#   -Probar   despues de copiar, restaura el bundle en una carpeta temporal y corre los tests (prueba de restauracion)
# Guarda 5 copias (las mas nuevas) y deja un resumen en respaldo.log dentro de la carpeta de destino.
param(
  [string]$Destino = "",
  [string]$Extra = "",
  [switch]$Probar
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$origen = (git -C $repo rev-parse --show-toplevel).Trim() -replace "/", "\"
$correo = "luismarceloescudero-debug/la-pichincha-correo"
if (-not $Destino) {
  $one = Join-Path $env:USERPROFILE "OneDrive"
  $Destino = if (Test-Path $one) { Join-Path $one "respaldo-pichincha" } else { Join-Path $env:USERPROFILE "Documents\respaldo-pichincha" }
}
$dia = Get-Date -Format "yyyy-MM-dd"
$d = Join-Path $Destino $dia
New-Item -ItemType Directory -Force $d | Out-Null
$log = @()
function Anotar($t) { $script:log += "$(Get-Date -Format 'HH:mm:ss') $t"; Write-Host $t }

# 1) Repo principal: bundle con todas las ramas e historial
git -C $origen bundle create (Join-Path $d "la-pichincha.bundle") --all 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { throw "fallo el bundle" }
Anotar "OK bundle del repo ($((git -C $origen rev-parse --short HEAD).Trim()))"

# 2) Repo privado de correos + issues en JSON
git clone --quiet --mirror "https://github.com/$correo" (Join-Path $d "correo.git")
$issues = Join-Path $d "issues.json"
gh issue list -R $correo --state all --limit 2000 --json number,title,body,labels,comments,createdAt,state | Out-File $issues -Encoding utf8
$n = (Get-Content $issues -Raw | ConvertFrom-Json).Count
Anotar "OK repo de correos e issues ($n)"

# 3) privado/ sin lo pesado que se regenera (node_modules, videos)
$priv = Join-Path $origen "privado"
if (Test-Path $priv) {
  $tmp = Join-Path $env:TEMP "priv-$dia"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  robocopy $priv $tmp /E /XD node_modules .git out /XF *.mp4 *.mov *.webm /NFL /NDL /NJH /NJS /NP | Out-Null
  Compress-Archive -Path "$tmp\*" -DestinationPath (Join-Path $d "privado.zip") -Force
  Remove-Item $tmp -Recurse -Force
  Anotar "OK privado.zip ($([math]::Round((Get-Item (Join-Path $d 'privado.zip')).Length/1MB,1)) MB)"
}

# 4) indice publicado
Invoke-WebRequest "https://pichinchadeldia.com.ar/indice.json" -OutFile (Join-Path $d "indice.json") -UseBasicParsing
Anotar "OK indice.json"

# 5) rotacion: quedan las 5 copias mas nuevas
Get-ChildItem $Destino -Directory | Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}$' } | Sort-Object Name -Descending | Select-Object -Skip 5 | ForEach-Object { Remove-Item $_.FullName -Recurse -Force; Anotar "borrada copia vieja $($_.Name)" }

# 6) prueba de restauracion
if ($Probar) {
  $t = Join-Path $env:TEMP "prueba-restauracion"
  if (Test-Path $t) { Remove-Item $t -Recurse -Force }
  git clone --quiet (Join-Path $d "la-pichincha.bundle") $t
  $a = (git -C $t rev-parse HEAD).Trim(); $b = (git -C $origen rev-parse HEAD).Trim()
  if ($a -ne $b) { Anotar "AVISO el commit restaurado ($a) no es el actual ($b)" } else { Anotar "OK mismo commit restaurado" }
  Push-Location $t
  node --test "tests/js/*.test.js" 2>&1 | Select-String "(pass|fail) \d+$" | ForEach-Object { Anotar "tests: $($_.Line)" }
  Pop-Location
  Remove-Item $t -Recurse -Force
}

$log | Out-File (Join-Path $Destino "respaldo.log") -Append -Encoding utf8

# 7) copia extra (pendrive o Drive de escritorio)
if ($Extra -and (Test-Path $Extra)) {
  robocopy $d (Join-Path $Extra $dia) /E /NFL /NDL /NJH /NJS /NP | Out-Null
  Write-Host "OK copia extra en $Extra"
} elseif ($Extra) { Write-Host "AVISO la carpeta extra no existe: $Extra" }
Write-Host "Listo: $d"
