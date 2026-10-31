#!/usr/bin/env bash
# Arma _sitio con el indice de prueba de tests/fixtures/e2e (sin red), igual que el job lighthouse arma el suyo
# con el indice publicado. Lo usan la CI (job e2e) y quien corre las pruebas en local.
set -euo pipefail
rm -rf _sitio
mkdir -p _sitio
cp index.html _sitio/
cp -r img js css _sitio/
cp tests/fixtures/e2e/indice.json _sitio/indice.json
python generar_paginas.py --indice _sitio/indice.json --salida _sitio
python publicar_app.py --salida _sitio --indice _sitio/indice.json
node generar_feed.js --indice _sitio/indice.json --salida _sitio
node generar_info.js --indice _sitio/indice.json --salud no-hay.json --salida _sitio
node generar_portada.js --salida _sitio
