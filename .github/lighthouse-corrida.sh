#!/usr/bin/env bash
# Corre el comando que recibe (una corrida de Lighthouse) y lo reintenta SOLO si Chrome no arranco en el runner
# ("waiting for dynamic debugging port in chrome-err.log": infraestructura, no un puntaje). Cualquier otra falla
# corta de inmediato; el puntaje lo evalua despues .github/lighthouse.js y ese si corta la CI.
# Variables: LH_INTENTOS (3 por defecto), LH_ESPERA (segundos entre intentos, 5 por defecto).
intentos=${LH_INTENTOS:-3}
espera=${LH_ESPERA:-5}
err=$(mktemp)
for n in $(seq 1 "$intentos"); do
  "$@" 2>"$err"
  codigo=$?
  cat "$err" >&2
  [ "$codigo" -eq 0 ] && break
  if ! grep -q "dynamic debugging port" "$err"; then break; fi
  echo "::warning::Chrome no arranco en el runner (intento $n de $intentos)" >&2
  [ "$n" -lt "$intentos" ] && sleep "$espera"
done
rm -f "$err"
exit "$codigo"
