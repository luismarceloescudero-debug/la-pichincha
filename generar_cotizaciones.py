#!/usr/bin/env python3
"""Escribe la copia de las cotizaciones que lleva el sitio (plan v3, K2).

Uso:
    python generar_cotizaciones.py --salida _sitio/cotizaciones.json

Baja las mismas tres fuentes que usa la pagina (js/monedas.js): dolarapi.com (tipos de dolar), open.er-api.com (monedas)
y frankfurter.dev (reserva de las monedas) y guarda sus respuestas crudas con la hora del build. La pagina las pide en vivo;
esta copia es lo que usa cuando no hay red o una fuente cae, y dice de hace cuanto es. Si ninguna fuente responde no
escribe nada (no pisa una copia buena con una vacia) y el build sigue: el sitio sale igual.
Solo biblioteca estandar, un pedido por fuente.
"""

import argparse
import json
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URLS = {
    "dolarapi": "https://dolarapi.com/v1/dolares",
    "erapi": "https://open.er-api.com/v6/latest/USD",
    "frankfurter": "https://api.frankfurter.dev/v1/latest?base=USD",
}
UA = "La Pichincha (+https://luismarceloescudero-debug.github.io/la-pichincha/) generar_cotizaciones.py"
TIEMPO_MAXIMO = 20   # segundos por fuente


def bajar(url):
    pedido = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(pedido, timeout=TIEMPO_MAXIMO) as r:
        return json.loads(r.read().decode("utf-8"))


def _trae_monedas(datos):
    """Al menos una moneda util: codigo de tres letras mayusculas (no el peso ni el dolar) con una tasa positiva."""
    rates = datos.get("rates") if isinstance(datos, dict) else None
    return isinstance(rates, dict) and any(
        isinstance(c, str) and len(c) == 3 and c.isascii() and c.isupper() and c not in ("ARS", "USD")
        and isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0
        for c, v in rates.items())


def _valida(nombre, datos):
    """La misma forma que exige la pagina: una respuesta rara se descarta en vez de guardarse."""
    if nombre == "dolarapi":
        return isinstance(datos, list) and any(
            isinstance(d, dict) and isinstance(d.get("venta"), (int, float)) and not isinstance(d["venta"], bool) and d["venta"] > 0
            for d in datos)
    if nombre == "erapi":
        return isinstance(datos, dict) and datos.get("result") == "success" and _trae_monedas(datos)
    return _trae_monedas(datos)


def generar(ahora, pedir=None):
    """{generado, dolarapi, erapi, frankfurter}; cada fuente que fallo o vino mal queda en None.
    Devuelve None si no anduvo ninguna. `pedir` se resuelve al llamar (no al definir) para poder reemplazar `bajar`."""
    pedir = pedir or bajar
    copia = {"generado": ahora.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    for nombre, url in URLS.items():
        try:
            datos = pedir(url)
        except Exception:      # una fuente caida no voltea el build: cualquier falla de red o de JSON cuenta igual
            datos = None
        copia[nombre] = datos if datos is not None and _valida(nombre, datos) else None
    return copia if any(copia[n] is not None for n in URLS) else None


def main(argv=None):
    ap = argparse.ArgumentParser(description="Copia de las cotizaciones para el sitio.")
    ap.add_argument("--salida", required=True, help="archivo a escribir, por ejemplo _sitio/cotizaciones.json")
    args = ap.parse_args(argv)
    copia = generar(datetime.now(timezone.utc))
    if copia is None:
        print("::warning::Ninguna fuente de cotizaciones respondio: el sitio sale sin copia y la calculadora depende de la red")
        return 0
    ruta = Path(args.salida)
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(copia, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    anduvieron = sum(copia[n] is not None for n in URLS)
    print(f"cotizaciones: {anduvieron} fuentes de {len(URLS)} en {ruta} ({ruta.stat().st_size} bytes)")
    if anduvieron < len(URLS):
        faltan = [n for n in URLS if copia[n] is None]
        print("::warning::Cotizaciones sin " + ", ".join(faltan))
    return 0


if __name__ == "__main__":
    sys.exit(main())
