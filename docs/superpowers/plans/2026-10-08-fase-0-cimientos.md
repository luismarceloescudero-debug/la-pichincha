# Fase 0: cimientos. Plan de implementacion

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar La Pichincha midiendo (GoatCounter), compartible por URL
(`?q=`), con el historial de precios a salvo en una rama propia, con avisos de
fuentes caidas y con tests que corren antes de cada publicacion.

**Architecture:** Sitio estatico en GitHub Pages, armado por una GitHub Action
con Python stdlib.

- **Logica pura y probable.** Va en modulos chicos: `historial.py`, `salud.py`,
  `js/buscador.js` y `js/pagina.js`.
- **Archivos que ya existen.** `indexar.py`, `actualizar.py` e `index.html`
  solo se cablean con esos modulos.
- **Una sola fuente del HTML.** `index.html` es el unico archivo que se edita a
  mano. La copia del artifact sale del build.

**Tech Stack:**

- Python 3.12, solo stdlib (`unittest`, `csv`, `json`, `subprocess`).
- JS de navegador sin build, en scripts clasicos.
- Node 22 o mas nuevo para `node --test`.
- GitHub Actions: `checkout@v4`, `setup-python@v5`, `setup-node@v4` y `gh` CLI.
- GoatCounter.

**Spec:** `docs/superpowers/specs/2026-10-08-fase-0-cimientos-design.md`

## Global Constraints

- **Dependencias:** ninguna nueva en Python, solo stdlib. Ninguna dependencia
  JS en el sitio.
- **UI:** nada nueva fuera de lo que piden F0.1 a F0.8. Solo cambian textos que
  ya existen, mas un aviso de carga cuando se abre un link con `?q=`.
- **Commits:** en español sin tildes, cerrando con
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **`main`:** no se pushea ni se mergea sin el OK explicito del dueño, porque
  cada push despliega.
- **GoatCounter:** cuenta `mescudero`, endpoint
  `https://mescudero.goatcounter.com/count` y script
  `https://gc.zgo.at/count.js`.
- **URL publica:**
  `https://luismarceloescudero-debug.github.io/la-pichincha/`.
- **Hora:** argentina, UTC-3 fijo (`timezone(timedelta(hours=-3))`).
- **Umbral de salud:** 0.7. Una fuente esta sana si no fallo, trajo al menos un
  producto y `previo == 0 or ahora >= 0.7 * previo`.
- **Historial:**
  - rama huerfana `historial`, un `AAAA-MM.csv` por mes;
  - columnas `fecha,tienda,id,precio`;
  - `id` = URL completa; precio vacio = dejo de publicarse;
  - UTF-8 sin BOM, `\n`.
- **Correr los tests** desde la raiz:
  - `python -m unittest discover -s tests -t . -v`
  - `node --test "tests/js/*.test.js"`
- **Avisos al dueño:** se anuncia el inicio y el fin de cada tarea. Las tareas
  que cambian la pantalla (8, 10 y 11) llevan capturas de antes y despues con
  el preview `web` de `.claude/launch.json`, que sirve en el puerto 8765.

## Review Focus

Casos que la spec da por cubiertos pero que ningun test obvio ejercita. Cada uno
tiene su prueba en la tarea indicada.

1. **Una fuente que falla o la bloquean.** No puede borrar su catalogo del
   historial ni contar como sana. Lo cubren los tests de la Tarea 3 (fuente que
   falla, fuente al 60%).
2. **La misma URL en dos fuentes** (CompraGamer y ComparaYa). Cada una conserva
   su propio `antes`. Lo cubre la Tarea 3.
3. **Consultas con caracteres especiales en la URL** (`&`, `#`, `%`, comillas,
   acentos). Tienen que ir y volver intactas. Lo cubre la Tarea 7, con un test
   de ida y vuelta.
4. **Un indice viejo con `generado` sin hora.** Tiene que mostrar "el 7/10" y no
   "Invalid Date". Lo cubre la Tarea 7.
5. **GoatCounter bloqueado o sin cargar.** La pagina no puede tirar errores y
   los eventos se descartan en silencio. Lo cubre la Tarea 9, que prueba la
   pagina con el script bloqueado y lee la consola.

---

### Task 1: Base de tests e `historial.py` (F0.4)

**Files:**
- Create: `historial.py`
- Create: `tests/__init__.py` (vacio)
- Test: `tests/test_historial.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `historial.leer(carpeta) -> dict[tuple[str, str], int]`
  - `historial.vivos_por_tienda(estado) -> collections.Counter`
  - `historial.cambios(estado, actuales, sanas, fecha) -> list[dict]`.
    `actuales` es `{(tienda, id): precio}` con las fuentes relevadas en esta
    corrida, `sanas` es `set[str]` y `fecha` es `"AAAA-MM-DD"`.
  - `historial.escribir(carpeta, fecha, filas) -> Path | None`
  - `historial.CAMPOS = ["fecha", "tienda", "id", "precio"]`

- [ ] **Step 1: Escribir los tests que fallan**

`tests/__init__.py` vacio. `tests/test_historial.py`:

```python
import csv
import shutil
import tempfile
import unittest
from pathlib import Path

import historial


def escribir_csv(ruta, filas):
    with ruta.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(historial.CAMPOS)
        w.writerows(filas)


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)


class Leer(Base):
    def test_carpeta_que_no_existe_es_historial_vacio(self):
        self.assertEqual(historial.leer(self.dir / "no-esta"), {})

    def test_pliega_los_meses_en_orden_y_gana_la_ultima_fila(self):
        escribir_csv(self.dir / "2026-11.csv", [["2026-11-02", "mexx", "u1", "800"]])
        escribir_csv(self.dir / "2026-10.csv", [["2026-10-07", "mexx", "u1", "1000"],
                                                ["2026-10-08", "mexx", "u1", "900"],
                                                ["2026-10-07", "cg", "u2", "50"]])
        self.assertEqual(historial.leer(self.dir), {("mexx", "u1"): 800, ("cg", "u2"): 50})

    def test_precio_vacio_borra_el_producto(self):
        escribir_csv(self.dir / "2026-10.csv", [["2026-10-07", "mexx", "u1", "1000"],
                                                ["2026-10-08", "mexx", "u1", ""]])
        self.assertEqual(historial.leer(self.dir), {})

    def test_ignora_archivos_que_no_son_de_un_mes(self):
        escribir_csv(self.dir / "2026-10.csv", [["2026-10-07", "mexx", "u1", "1000"]])
        (self.dir / "LEEME.md").write_text("hola", encoding="utf-8")
        escribir_csv(self.dir / "viejo.csv", [["2020-01-01", "mexx", "u9", "1"]])
        self.assertEqual(historial.leer(self.dir), {("mexx", "u1"): 1000})

    def test_vivos_por_tienda(self):
        estado = {("mexx", "a"): 1, ("mexx", "b"): 2, ("cg", "c"): 3}
        self.assertEqual(historial.vivos_por_tienda(estado), {"mexx": 2, "cg": 1})


class Cambios(unittest.TestCase):
    ESTADO = {("mexx", "a"): 100, ("mexx", "b"): 200, ("cg", "c"): 300}

    def test_nuevos_y_cambiados_si_iguales_no(self):
        actuales = {("mexx", "a"): 100, ("mexx", "b"): 150, ("mexx", "n"): 999}
        filas = historial.cambios(self.ESTADO, actuales, set(), "2026-10-08")
        self.assertEqual(filas, [
            {"fecha": "2026-10-08", "tienda": "mexx", "id": "b", "precio": 150},
            {"fecha": "2026-10-08", "tienda": "mexx", "id": "n", "precio": 999},
        ])

    def test_bajas_solo_en_fuentes_sanas(self):
        actuales = {("mexx", "a"): 100}
        sana = historial.cambios(self.ESTADO, actuales, {"mexx"}, "2026-10-08")
        self.assertIn({"fecha": "2026-10-08", "tienda": "mexx", "id": "b", "precio": ""}, sana)
        enferma = historial.cambios(self.ESTADO, actuales, set(), "2026-10-08")
        self.assertEqual(enferma, [])

    def test_fuente_no_relevada_no_escribe_nada(self):
        # cg no esta en actuales ni en sanas: no se toco en esta corrida.
        filas = historial.cambios(self.ESTADO, {("mexx", "a"): 100, ("mexx", "b"): 200},
                                  {"mexx"}, "2026-10-08")
        self.assertEqual(filas, [])

    def test_vuelve_despues_de_una_baja_como_nuevo(self):
        estado = {}                                   # se dio de baja antes
        filas = historial.cambios(estado, {("mexx", "a"): 90}, {"mexx"}, "2026-10-09")
        self.assertEqual(filas, [{"fecha": "2026-10-09", "tienda": "mexx", "id": "a", "precio": 90}])


class Escribir(Base):
    def test_crea_el_mes_con_encabezado_y_despues_agrega(self):
        f1 = [{"fecha": "2026-10-08", "tienda": "mexx", "id": "https://x/a,b", "precio": 100}]
        f2 = [{"fecha": "2026-10-09", "tienda": "mexx", "id": "https://x/a,b", "precio": ""}]
        ruta = historial.escribir(self.dir, "2026-10-08", f1)
        historial.escribir(self.dir, "2026-10-09", f2)
        self.assertEqual(ruta.name, "2026-10.csv")
        texto = ruta.read_bytes().decode("utf-8")
        self.assertEqual(texto, 'fecha,tienda,id,precio\n2026-10-08,mexx,"https://x/a,b",100\n'
                                '2026-10-09,mexx,"https://x/a,b",\n')
        self.assertEqual(historial.leer(self.dir), {})

    def test_mes_nuevo_va_a_otro_archivo(self):
        historial.escribir(self.dir, "2026-10-31", [{"fecha": "2026-10-31", "tienda": "a", "id": "1", "precio": 1}])
        historial.escribir(self.dir, "2026-11-01", [{"fecha": "2026-11-01", "tienda": "a", "id": "1", "precio": 2}])
        self.assertEqual(sorted(p.name for p in self.dir.glob("*.csv")), ["2026-10.csv", "2026-11.csv"])
        self.assertEqual(historial.leer(self.dir), {("a", "1"): 2})

    def test_sin_filas_no_toca_nada(self):
        self.assertIsNone(historial.escribir(self.dir / "nueva", "2026-10-08", []))
        self.assertFalse((self.dir / "nueva").exists())
```

- [ ] **Step 2: Correr y ver que falla**

Run: `python -m unittest discover -s tests -t . -v`
Expected: ERROR `ModuleNotFoundError: No module named 'historial'`

- [ ] **Step 3: Implementar `historial.py`**

```python
"""Historial de precios del indice: un CSV por mes con solo los cambios.

Vive en la rama huerfana `historial` (en la Action se saca en la carpeta
historial/), asi no depende de la cache de Actions, que GitHub puede desalojar.

Columnas: fecha,tienda,id,precio. id es la URL del producto. Se escribe una
fila cuando un producto aparece o cambia de precio, y una con el precio vacio
cuando deja de publicarse: si vuelve, cuenta como nuevo y no se lo compara
contra un precio de hace meses.
"""

import csv
from collections import Counter
from pathlib import Path

CAMPOS = ["fecha", "tienda", "id", "precio"]
PATRON = "[0-9][0-9][0-9][0-9]-[0-9][0-9].csv"


def archivos(carpeta):
    carpeta = Path(carpeta)
    return sorted(carpeta.glob(PATRON)) if carpeta.is_dir() else []


def leer(carpeta):
    """Ultimo precio conocido de cada (tienda, id) que sigue publicado."""
    estado = {}
    for ruta in archivos(carpeta):
        with ruta.open(encoding="utf-8", newline="") as f:
            for fila in csv.DictReader(f):
                clave = (fila["tienda"], fila["id"])
                if fila["precio"]:
                    estado[clave] = int(fila["precio"])
                else:
                    estado.pop(clave, None)
    return estado


def vivos_por_tienda(estado):
    return Counter(tienda for tienda, _ in estado)


def cambios(estado, actuales, sanas, fecha):
    """Las filas nuevas de esta corrida.

    actuales trae solo las fuentes relevadas hoy. Las bajas se escriben solo
    para las fuentes sanas: una tienda que bloqueo a medias no borra su
    catalogo del historial.
    """
    filas = []
    for (tienda, id_), precio in sorted(actuales.items()):
        if estado.get((tienda, id_)) != precio:
            filas.append({"fecha": fecha, "tienda": tienda, "id": id_, "precio": precio})
    for (tienda, id_) in sorted(estado):
        if tienda in sanas and (tienda, id_) not in actuales:
            filas.append({"fecha": fecha, "tienda": tienda, "id": id_, "precio": ""})
    return filas


def escribir(carpeta, fecha, filas):
    """Agrega las filas al CSV del mes de `fecha`. Devuelve la ruta, o None si no habia nada."""
    if not filas:
        return None
    carpeta = Path(carpeta)
    carpeta.mkdir(parents=True, exist_ok=True)
    ruta = carpeta / (fecha[:7] + ".csv")
    nuevo = not ruta.exists()
    with ruta.open("a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS, lineterminator="\n")
        if nuevo:
            w.writeheader()
        w.writerows(filas)
    return ruta
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `python -m unittest discover -s tests -t . -v`
Expected: 12 tests OK

- [ ] **Step 5: Commit**

```bash
git add historial.py tests/__init__.py tests/test_historial.py
git commit -m "Historial de precios en CSV mensual con solo los cambios"
```

---

### Task 2: `salud.py` (F0.6)

**Files:**
- Create: `salud.py`
- Test: `tests/test_salud.py`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `salud.UMBRAL = 0.7` y `salud.ETIQUETA = "salud-fuente"`
  - `salud.evaluar(vivos, relevados, nombres, fecha, umbral=UMBRAL) -> dict`.
    Devuelve `{"fecha", "umbral", "fuentes": {clave: {"nombre", "previo", "ahora", "estado"}}}`,
    con `estado` en `ok`, `baja` o `fallo`.
  - `salud.alertas(informe | None) -> list[dict]`
  - `salud.titulo(alerta) -> str` y `salud.cuerpo(alerta, url_corrida) -> str`
  - `salud.main(argv=None) -> int`. Recibe la ruta de `salud.json` y `--seco`.
  - `salud.gh(*args) -> str`, que corre `gh` y devuelve stdout. Los tests lo
    reemplazan.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/test_salud.py`:

```python
import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import salud

FECHA = "2026-10-08T15:25-03:00"


class Evaluar(unittest.TestCase):
    def test_estados_con_el_umbral_justo(self):
        informe = salud.evaluar({"a": 100, "b": 100, "c": 100}, {"a": 70, "b": 69, "c": 0, "d": 5},
                                {"a": "A", "b": "B", "c": "C"}, FECHA)
        estados = {k: v["estado"] for k, v in informe["fuentes"].items()}
        self.assertEqual(estados, {"a": "ok", "b": "baja", "c": "fallo", "d": "ok"})
        self.assertEqual(informe["fuentes"]["d"], {"nombre": "d", "previo": 0, "ahora": 5, "estado": "ok"})
        self.assertEqual((informe["fecha"], informe["umbral"]), (FECHA, 0.7))

    def test_fuente_nueva_sin_productos_es_fallo(self):
        informe = salud.evaluar({}, {"nueva": 0}, {"nueva": "Nueva"}, FECHA)
        self.assertEqual(informe["fuentes"]["nueva"]["estado"], "fallo")


class Alertas(unittest.TestCase):
    def test_solo_las_que_no_estan_ok(self):
        informe = salud.evaluar({"a": 100, "b": 100}, {"a": 90, "b": 10}, {"a": "A", "b": "Mexx"}, FECHA)
        lista = salud.alertas(informe)
        self.assertEqual([a["clave"] for a in lista], ["b"])
        self.assertEqual(salud.titulo(lista[0]), "Fuente con pocos productos: Mexx")
        texto = salud.cuerpo(lista[0], "https://github.com/x/y/actions/runs/1")
        for parte in ("**Mexx**", "10 productos", "contra 100", "10%", "actions/runs/1",
                      "indexar.py --probar", "tests/capturar.py"):
            self.assertIn(parte, texto)

    def test_sin_informe_es_el_indexado_caido(self):
        lista = salud.alertas(None)
        self.assertEqual(len(lista), 1)
        self.assertEqual(salud.titulo(lista[0]), "El indexado de precios no termino")
        self.assertIn("actions/runs/9", salud.cuerpo(lista[0], "https://github.com/x/y/actions/runs/9"))


class Main(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.ruta = self.dir / "salud.json"
        informe = salud.evaluar({"mexx": 900, "cg": 1500}, {"mexx": 100, "cg": 1500},
                                {"mexx": "Mexx", "cg": "CompraGamer"}, FECHA)
        self.ruta.write_text(json.dumps(informe), encoding="utf-8")
        self.llamadas = []

    def falso_gh(self, abiertos):
        def gh(*args):
            self.llamadas.append(args)
            return json.dumps(abiertos) if args[:2] == ("issue", "list") else ""
        return gh

    def correr(self, *argv, abiertos=()):
        with mock.patch.object(salud, "gh", self.falso_gh(list(abiertos))), redirect_stdout(io.StringIO()) as out:
            self.assertEqual(salud.main([str(self.ruta), *argv]), 0)
        return out.getvalue()

    def test_abre_un_issue_por_fuente_caida(self):
        self.correr()
        verbos = [a[:2] for a in self.llamadas]
        self.assertEqual(verbos, [("label", "create"), ("issue", "list"), ("issue", "create")])
        crear = self.llamadas[-1]
        self.assertIn("Fuente con pocos productos: Mexx", crear)
        self.assertIn(salud.ETIQUETA, crear)

    def test_si_ya_hay_uno_abierto_comenta(self):
        self.correr(abiertos=[{"number": 7, "title": "Fuente con pocos productos: Mexx"}])
        self.assertEqual(self.llamadas[-1][:3], ("issue", "comment", "7"))

    def test_seco_no_llama_a_gh(self):
        out = self.correr("--seco")
        self.assertEqual(self.llamadas, [])
        self.assertIn("Fuente con pocos productos: Mexx", out)

    def test_todo_sano_no_hace_nada(self):
        self.ruta.write_text(json.dumps(salud.evaluar({"a": 1}, {"a": 1}, {}, FECHA)), encoding="utf-8")
        self.correr()
        self.assertEqual(self.llamadas, [])

    def test_sin_archivo_avisa_el_indexado_caido(self):
        self.ruta.unlink()
        self.correr()
        self.assertIn("El indexado de precios no termino", self.llamadas[-1])
```

- [ ] **Step 2: Correr y ver que falla**

Run: `python -m unittest tests.test_salud -v`
Expected: ERROR `No module named 'salud'`

- [ ] **Step 3: Implementar `salud.py`**

```python
#!/usr/bin/env python3
"""Salud de las fuentes: avisa con un issue cuando una tienda trae poco.

Uso:
    python salud.py salud.json          # abre o comenta issues con gh
    python salud.py salud.json --seco   # solo muestra lo que haria

indexar.py escribe salud.json con evaluar(). Una fuente esta sana si no
fallo, trajo al menos un producto y llego al 70% de los productos vivos que
tenia en el historial. Con la misma regla el historial decide si registra las
bajas de esa fuente.
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

UMBRAL = 0.7
ETIQUETA = "salud-fuente"
SALUD = Path(__file__).resolve().parent / "salud.json"


def evaluar(vivos, relevados, nombres, fecha, umbral=UMBRAL):
    """Compara lo que trajo cada fuente relevada hoy contra lo que tenia vivo."""
    fuentes = {}
    for clave, ahora in relevados.items():
        previo = vivos.get(clave, 0)
        if ahora == 0:
            estado = "fallo"
        elif previo and ahora < umbral * previo:
            estado = "baja"
        else:
            estado = "ok"
        fuentes[clave] = {"nombre": nombres.get(clave, clave), "previo": previo,
                          "ahora": ahora, "estado": estado}
    return {"fecha": fecha, "umbral": umbral, "fuentes": fuentes}


def alertas(informe):
    if informe is None:                       # indexar.py se cayo antes de escribirlo
        return [{"clave": "indexado", "nombre": "el indexado", "previo": 0, "ahora": 0,
                 "estado": "caido"}]
    return [dict(f, clave=k) for k, f in informe["fuentes"].items() if f["estado"] != "ok"]


def titulo(alerta):
    if alerta["estado"] == "caido":
        return "El indexado de precios no termino"
    return "Fuente con pocos productos: " + alerta["nombre"]


def cuerpo(alerta, url_corrida):
    if alerta["estado"] == "caido":
        return ("El paso `indexar.py` de la corrida programada fallo antes de escribir "
                "`salud.json`, asi que no hay numeros por fuente. El sitio se publico con "
                "el indice anterior.\n\nCorrida: " + url_corrida)
    pct = round(100 * alerta["ahora"] / alerta["previo"]) if alerta["previo"] else 0
    return "\n".join([
        f"**{alerta['nombre']}** trajo {alerta['ahora']} productos contra {alerta['previo']} "
        f"de la corrida anterior ({pct}%). El umbral es {round(100 * UMBRAL)}%.",
        "",
        "Mientras siga abajo del umbral, el historial no registra sus bajas: una tienda que "
        "bloquea a medias no borra su catalogo.",
        "",
        "Que revisar:",
        "- `python indexar.py --solo " + alerta["clave"] + " --max-paginas 2` para ver si responde.",
        "- `python indexar.py --probar <url de un producto>` si cambio la plantilla.",
        "- `python tests/capturar.py " + alerta["clave"] + "` y los tests, para ver que regex rompio.",
        "",
        "Corrida: " + url_corrida,
    ])


def url_corrida():
    e = os.environ
    if e.get("GITHUB_RUN_ID"):
        return f"{e.get('GITHUB_SERVER_URL', 'https://github.com')}/{e['GITHUB_REPOSITORY']}/actions/runs/{e['GITHUB_RUN_ID']}"
    return "(corrida local)"


def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def main(argv=None):
    ap = argparse.ArgumentParser(description="Abre issues cuando una fuente trae poco.")
    ap.add_argument("ruta", nargs="?", default=str(SALUD))
    ap.add_argument("--seco", action="store_true", help="muestra lo que haria sin tocar GitHub")
    args = ap.parse_args(argv)

    ruta = Path(args.ruta)
    informe = json.loads(ruta.read_text(encoding="utf-8")) if ruta.exists() else None
    lista = alertas(informe)
    if not lista:
        print("todas las fuentes sanas")
        return 0

    url = url_corrida()
    if args.seco:
        for a in lista:
            print("# " + titulo(a) + "\n\n" + cuerpo(a, url) + "\n")
        return 0

    gh("label", "create", ETIQUETA, "--color", "d93f0b",
       "--description", "Una fuente de precios trajo menos de lo esperado", "--force")
    abiertos = {i["title"]: i["number"] for i in json.loads(
        gh("issue", "list", "--label", ETIQUETA, "--state", "open", "--json", "number,title",
           "--limit", "100") or "[]")}
    for a in lista:
        t, c = titulo(a), cuerpo(a, url)
        if t in abiertos:
            gh("issue", "comment", str(abiertos[t]), "--body", c)
            print("comentado #" + str(abiertos[t]) + ": " + t)
        else:
            gh("issue", "create", "--title", t, "--body", c, "--label", ETIQUETA)
            print("abierto: " + t)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `python -m unittest discover -s tests -t . -v`
Expected: todos OK (12 + 9)

- [ ] **Step 5: Commit**

```bash
git add salud.py tests/test_salud.py
git commit -m "Salud de fuentes: issue cuando una tienda trae menos del 70%"
```

---

### Task 3: `indexar.py` usa el historial y la salud (F0.4, F0.6 y F0.8 en el indice)

**Files:**
- Modify: `indexar.py`: imports, constantes, `main()` y el resumen final.
- Modify: `.gitignore`: suma `historial/` y `salud.json`.
- Test: `tests/test_indexar_corrida.py`

**Interfaces:**
- Consumes: `historial.leer`, `historial.vivos_por_tienda`,
  `historial.cambios`, `historial.escribir` y `salud.evaluar`.
- Produces:
  - `indexar.main(argv=None)` con `--historial DIR` (por defecto
    `RAIZ / "historial"`);
  - las constantes `indexar.HISTORIAL`, `indexar.SALUD` e `indexar.AR`;
  - `indice.json` con `generado` en ISO con hora (`2026-10-08T15:25-03:00`);
  - `salud.json` en la raiz;
  - se van `indexar.PRECIOS` y `precios.json`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/test_indexar_corrida.py`:

```python
import csv
import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest import mock

import indexar

BASE = "https://tienda.test"


def fuente(nombre, catalogo):
    return {"nombre": nombre, "color": "cg", "activa": True, "base": BASE,
            "catalogo": {"tipo": "json", "url": catalogo, "ruta": "p/{slug}_{id}",
                         "campos": {"id": "id", "nombre": "nombre", "precio": "precio", "lista": "lista"}}}


def url(i):
    return f"{BASE}/p/Producto_{i}_{i}"


class Corrida(unittest.TestCase):
    """Corre indexar.main() entero contra dos fuentes JSON de mentira."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.hist = self.dir / "historial"
        tiendas = {"_nota": "prueba", "uno": fuente("Uno", "https://uno.test/cat"),
                   "dos": fuente("Dos", "https://dos.test/cat")}
        (self.dir / "tiendas.json").write_text(json.dumps(tiendas), encoding="utf-8")
        for nombre, archivo in (("TIENDAS", "tiendas.json"), ("INDICE", "indice.json"), ("SALUD", "salud.json")):
            p = mock.patch.object(indexar, nombre, self.dir / archivo)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.object(indexar, "bajar", self.bajar)
        p.start()
        self.addCleanup(p.stop)
        self.catalogos = {}

    def bajar(self, u):
        if u not in self.catalogos:
            raise OSError("sin conexion: " + u)
        return json.dumps(self.catalogos[u])

    def correr(self, uno, dos):
        """uno y dos: listas de (id, precio), o None para que esa fuente falle."""
        self.catalogos = {}
        for u, filas in (("https://uno.test/cat", uno), ("https://dos.test/cat", dos)):
            if filas is not None:
                self.catalogos[u] = [{"id": i, "nombre": f"Producto {i}", "precio": p} for i, p in filas]
        with redirect_stdout(io.StringIO()):
            self.assertEqual(indexar.main(["--historial", str(self.hist)]), 0)
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        salud = json.loads((self.dir / "salud.json").read_text(encoding="utf-8"))
        return indice, salud

    def filas(self):
        salida = []
        for ruta in sorted(self.hist.glob("*.csv")):
            with ruta.open(encoding="utf-8", newline="") as f:
                salida += [(r["tienda"], r["id"], r["precio"]) for r in csv.DictReader(f)]
        return salida

    def fila(self, indice, tienda, i):
        return next(f for f in indice["productos"] if f[3] == tienda and f[2] == url(i))

    def test_primera_corrida_escribe_la_foto_completa(self):
        indice, salud = self.correr([(1, 1000), (2, 2000)], [(101, 500)])
        self.assertEqual(sorted(self.filas()), [("dos", url(101), "500"), ("uno", url(1), "1000"),
                                                ("uno", url(2), "2000")])
        self.assertRegex(indice["generado"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}-03:00$")
        self.assertEqual(salud["fecha"], indice["generado"])
        self.assertEqual(salud["fuentes"]["uno"], {"nombre": "Uno", "previo": 0, "ahora": 2, "estado": "ok"})
        self.assertTrue(all(f[6] == 0 for f in indice["productos"]))

    def test_una_baja_de_precio_queda_en_antes_y_en_el_csv(self):
        self.correr([(1, 1000), (2, 2000)], [(101, 500)])
        indice, _ = self.correr([(1, 900), (2, 2000)], [(101, 500)])
        self.assertEqual(self.fila(indice, "uno", 1)[6], 1000)
        self.assertEqual(self.fila(indice, "uno", 2)[6], 0)
        self.assertEqual(self.filas()[-1], ("uno", url(1), "900"))

    def test_producto_que_desaparece_de_una_fuente_sana_queda_como_baja(self):
        diez = [(i, 1000) for i in range(1, 11)]
        self.correr(diez, [(101, 500)])
        self.correr(diez[:9], [(101, 500)])                     # 90%: sana
        self.assertIn(("uno", url(10), ""), self.filas())
        indice, _ = self.correr(diez[:9] + [(10, 800)], [(101, 500)])
        self.assertEqual(self.fila(indice, "uno", 10)[6], 0)     # vuelve como nuevo: no es una baja
        self.assertEqual(self.filas()[-1], ("uno", url(10), "800"))

    def test_fuente_bajo_el_umbral_no_borra_su_catalogo(self):
        diez = [(i, 1000) for i in range(1, 11)]
        self.correr(diez, [(101, 500)])
        antes = len(self.filas())
        _, salud = self.correr([(1, 700)] + diez[1:6], [(101, 500)])  # 6 de 10: 60%
        self.assertEqual(salud["fuentes"]["uno"]["estado"], "baja")
        nuevas = self.filas()[antes:]
        self.assertEqual(nuevas, [("uno", url(1), "700")])       # registra el precio, no las bajas

    def test_fuente_que_falla_cuenta_cero_y_conserva_el_indice_anterior(self):
        self.correr([(1, 1000)], [(101, 500)])
        antes = len(self.filas())
        indice, salud = self.correr(None, [(101, 500)])
        self.assertEqual(salud["fuentes"]["uno"], {"nombre": "Uno", "previo": 1, "ahora": 0, "estado": "fallo"})
        self.assertEqual(self.fila(indice, "uno", 1)[1], 1000)   # publica lo que ya tenia
        self.assertEqual(len(self.filas()), antes)

    def test_la_misma_url_en_dos_fuentes_tiene_su_propio_antes(self):
        self.correr([(1, 1000)], [(1, 1200)])
        indice, _ = self.correr([(1, 900)], [(1, 1200)])
        self.assertEqual(self.fila(indice, "uno", 1)[6], 1000)
        self.assertEqual(self.fila(indice, "dos", 1)[6], 0)
```

- [ ] **Step 2: Correr y ver que falla**

Run: `python -m unittest tests.test_indexar_corrida -v`
Expected: FAIL o ERROR. `main()` no acepta argumentos, no existe `indexar.SALUD`
y `generado` no tiene hora.

- [ ] **Step 3: Cambiar `indexar.py`**

1. **Imports.** Se reemplaza `from datetime import date` por
   `from datetime import datetime, timedelta, timezone`. Al final de los
   imports de stdlib va `import historial` y `import salud`.
2. **Constantes.** Se reemplaza
   `PRECIOS = RAIZ / "precios.json"   # la foto del relevamiento anterior` por:

```python
HISTORIAL = RAIZ / "historial"    # la rama `historial`: un CSV por mes con los cambios
SALUD = RAIZ / "salud.json"       # cuanto trajo cada fuente, para avisar si se cae
AR = timezone(timedelta(hours=-3))  # Argentina no tiene horario de verano
```

3. **`main()`.**
   - **Argumentos.** La firma pasa a `def main(argv=None):`, se suma
     `ap.add_argument("--historial", metavar="DIR", default=str(HISTORIAL), help="carpeta del historial de precios")`
     y `args = ap.parse_args(argv)`.
   - **Lectura del historial.** El bloque que lee `PRECIOS` (desde el
     comentario "La foto de precios vive aparte del indice a proposito" hasta
     `antes = {}`) se cambia por:

```python
    # El historial vive en su propia rama y no en la cache de Actions. La clave
    # es (tienda, url): CompraGamer y ComparaYa publican las mismas URLs con
    # precios distintos, y con la URL sola una pisaba a la otra.
    carpeta = Path(args.historial)
    estado = historial.leer(carpeta)
    vivos = historial.vivos_por_tienda(estado)
```

   - **Variables del bucle.** `salida, resumen = [], {}` pasa a
     `salida, resumen, relevados, actuales = [], {}, {}, {}`.
   - **Fuente que falla.** En el `except Exception as e:`, antes del
     `continue`, se agrega `relevados[clave] = 0`.
   - **Despues de armar `items`.** Despues de
     `rebaja_real = bool(fuente.get("lista_es_oferta"))` se agrega
     `relevados[clave] = len(items)`.
   - **Adentro del `for it in items:`.**
     - `ayer = antes.get(it["url"]) or 0` pasa a
       `ayer = estado.get((clave, it["url"])) or 0`.
     - El comentario de arriba pasa a: `# Baja propia: lo que valia segun el historial. No depende de lo que publique la tienda, asi que vale para las cinco.`
     - Antes del `salida.append(...)` se agrega
       `actuales[(clave, it["url"])] = it["precio"]`.

4. **Despues del bucle y antes de `datos = {`:**

```python
    generado = datetime.now(AR).isoformat(timespec="minutes")
    informe = salud.evaluar(vivos, relevados, {k: v["nombre"] for k, v in fuentes.items()}, generado)
    sanas = {k for k, f in informe["fuentes"].items() if f["estado"] == "ok"}
    filas = historial.cambios(estado, actuales, sanas, generado[:10])
    ruta_csv = historial.escribir(carpeta, generado[:10], filas)
    SALUD.write_text(json.dumps(informe, ensure_ascii=False, indent=1), encoding="utf-8")
```

5. **`datos`.** En el dict, `"generado": date.today().isoformat(),` pasa a
   `"generado": generado,`.
6. **Escritura de `PRECIOS`.** Se borra el bloque que la hacia (el comentario
   "La foto para la proxima corrida" y su `PRECIOS.write_text(...)`).
7. **Resumen final.** El bloque `if antes: ... else: ...` del final se cambia
   por:

```python
    if estado:
        print("  " + VERDE + OK + FIN + " " + str(bajaron) + " bajaron de precio segun el historial")
    else:
        print("  " + GRIS + "historial vacio: las bajas propias empiezan a contar "
              "desde la proxima corrida" + FIN)
    if ruta_csv:
        print("  " + VERDE + OK + FIN + " historial " + PUNTO + " " + str(len(filas))
              + " filas nuevas en " + ruta_csv.name)
    for clave, f in informe["fuentes"].items():
        if f["estado"] != "ok":
            print("  " + AMAR + "! " + f["nombre"] + ": " + str(f["ahora"]) + " productos contra "
                  + str(f["previo"]) + " (" + f["estado"] + ")" + FIN)
```

8. **`.gitignore`.** Se agregan las lineas `historial/` y `salud.json`.

- [ ] **Step 4: Correr todos los tests**

Run: `python -m unittest discover -s tests -t . -v`
Expected: todos OK. Tambien `python indexar.py --help` muestra `--historial`.

- [ ] **Step 5: Commit**

```bash
git add indexar.py .gitignore tests/test_indexar_corrida.py
git commit -m "El indexador lee y escribe el historial y mide la salud de cada fuente"
```

---

### Task 4: Tests de los extractores con HTML guardado (F0.5 Python)

**Files:**
- Create: `tests/capturar.py`
- Create: `tests/fixtures/{gamingcity,mexx,fullh4rd}/{listado,producto}.html`, `tests/fixtures/compragamer/catalogo.json`, `tests/fixtures/comparaya/api.json` (los genera `capturar.py`)
- Test: `tests/test_indexar.py`, `tests/test_actualizar.py`

**Interfaces:**
- Consumes: `indexar.bajar`, `indexar.listados`, `indexar.tarjetas`,
  `indexar.indexar_json`, `indexar.indexar_api`, `indexar.numero`,
  `indexar.absoluta`, `indexar.limpio` e `indexar.imagen`; ademas
  `actualizar.bajar`, `actualizar.EXTRACTORES`, `actualizar.precio_*`,
  `actualizar.CATALOGO_CG` y `actualizar._cache_cg`.
- Produces: los fixtures en `tests/fixtures/`, que usan estos tests.

- [ ] **Step 1: Escribir `tests/capturar.py`**

```python
#!/usr/bin/env python3
"""Baja y recorta el HTML guardado que usan los tests de los extractores.

Uso, desde la raiz del repo:
    python tests/capturar.py              # todas las fuentes
    python tests/capturar.py mexx         # una sola

Los tests no salen a la red: leen lo que deja este script en tests/fixtures/.
Se vuelve a correr cuando una tienda cambia su plantilla (la Action abre un
issue "Fuente con pocos productos"): el test falla contra el HTML nuevo y se
corrige la regex en tiendas.json.
"""

import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ))

import actualizar  # noqa: E402
import indexar  # noqa: E402

FIXTURES = RAIZ / "tests" / "fixtures"
TARJETAS = 4          # tarjetas por listado
FILAS = 5             # filas de los catalogos JSON
SIN_CODIGO = re.compile(r"<(script|style|svg)\b[\s\S]*?</\1>", re.I)
DATOS = json.loads((RAIZ / "datos.json").read_text(encoding="utf-8"))
TIENDAS = json.loads((RAIZ / "tiendas.json").read_text(encoding="utf-8"))


def guardar(clave, nombre, texto):
    ruta = FIXTURES / clave / nombre
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(texto, encoding="utf-8", newline="\n")
    print(f"  {ruta.relative_to(RAIZ).as_posix()} · {len(texto.encode()) // 1024} KB")


def listado(clave, tienda):
    """Las primeras tarjetas que se leen enteras, tal como las parte tarjetas()."""
    cfg = tienda["catalogo"]
    for fuente in indexar.listados(tienda)[:15]:
        html = indexar.bajar(cfg["pagina"].format(listado=fuente, n=cfg.get("desde", 1)))
        buenas = [t for t in html.split(cfg["tarjeta"])[1:]
                  if len(indexar.tarjetas(cfg["tarjeta"] + t, cfg)) == 1]
        if len(buenas) >= TARJETAS:
            guardar(clave, "listado.html", "".join(cfg["tarjeta"] + t for t in buenas[:TARJETAS]))
            return
    raise SystemExit(f"{clave}: ningun listado trajo {TARJETAS} tarjetas legibles")


def producto(clave):
    """La pagina de un producto curado, sin scripts ni estilos si el extractor lee lo mismo."""
    prod = next(p for p in DATOS["productos"] if p["tienda"] == clave and p["fuente"]["tipo"] != "compragamer")
    extractor = actualizar.EXTRACTORES[prod["fuente"]["tipo"]]
    html = actualizar.bajar(prod["url"])
    chico = SIN_CODIGO.sub("", html)

    def leer_con(texto):
        original = actualizar.bajar
        actualizar.bajar = lambda url, binario=False: texto
        try:
            return extractor(prod)
        finally:
            actualizar.bajar = original

    completo = leer_con(html)
    guardar(clave, "producto.html", chico if leer_con(chico) == completo else html)


def compragamer():
    filas = json.loads(indexar.bajar(actualizar.CATALOGO_CG))
    curados = {int(p["fuente"]["id_producto"]) for p in DATOS["productos"]
               if p["fuente"]["tipo"] == "compragamer"}
    elegidas = [f for f in filas if int(f["id_producto"]) in curados]
    elegidas += [f for f in filas if int(f["id_producto"]) not in curados and f.get("imagenes")][:FILAS]
    guardar("compragamer", "catalogo.json", json.dumps(elegidas, ensure_ascii=False, indent=1))


def comparaya(tienda):
    cfg = tienda["catalogo"]
    cuerpo = json.loads(indexar.bajar(cfg["plantilla"].format(categoria=cfg["categorias"][0], n=1)))
    guardar("comparaya", "api.json",
            json.dumps({cfg["lista"]: cuerpo[cfg["lista"]][:FILAS]}, ensure_ascii=False, indent=1))


def main(argv):
    pedidas = set(argv) or {k for k in TIENDAS if not k.startswith("_")}
    for clave in sorted(pedidas):
        print(clave)
        tienda = TIENDAS[clave]
        if clave == "compragamer":
            compragamer()
        elif clave == "comparaya":
            comparaya(tienda)
        else:
            listado(clave, tienda)
            producto(clave)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

- [ ] **Step 2: Capturar los fixtures (sale a la red una vez)**

Run: `python tests/capturar.py`
Expected: lista 8 archivos bajo `tests/fixtures/`, cada uno de menos de
~300 KB. Si una tienda no responde, se reintenta solo esa
(`python tests/capturar.py mexx`).

- [ ] **Step 3: Escribir `tests/test_indexar.py`**

```python
import json
import unittest
from pathlib import Path
from unittest import mock

import indexar

RAIZ = Path(__file__).resolve().parent.parent
FIX = RAIZ / "tests" / "fixtures"
TIENDAS = json.loads((RAIZ / "tiendas.json").read_text(encoding="utf-8"))


def leer(clave, nombre):
    return (FIX / clave / nombre).read_text(encoding="utf-8")


def miles(n):
    return f"{n:,}".replace(",", ".")


class Utilidades(unittest.TestCase):
    def test_numero(self):
        self.assertEqual(indexar.numero("284.050"), 284050)
        self.assertEqual(indexar.numero("23.450,01"), 23450)
        self.assertIsNone(indexar.numero(None))
        self.assertIsNone(indexar.numero("consultar"))

    def test_absoluta(self):
        self.assertEqual(indexar.absoluta("https://x.com", "/a/b"), "https://x.com/a/b")
        self.assertEqual(indexar.absoluta("https://x.com", "a-b--det--1"), "https://x.com/a-b--det--1")
        self.assertEqual(indexar.absoluta("https://x.com", "https://y.com/z"), "https://y.com/z")

    def test_limpio_decodifica_entidades(self):
        self.assertEqual(indexar.limpio('SSD 2.5&quot;  Kingston\n &amp; más'), 'SSD 2.5" Kingston & más')

    def test_imagen_toma_la_de_menor_orden(self):
        cfg = {"campos": {"imagen": "imagenes"}, "imagen_url": "https://img.test/{nombre}"}
        fila = {"imagenes": [{"nombre": "b.jpg", "orden": 2}, {"nombre": "a.jpg", "orden": 1}]}
        self.assertEqual(indexar.imagen(fila, cfg), "https://img.test/a.jpg")
        self.assertEqual(indexar.imagen({}, cfg), "")


class TarjetasSinteticas(unittest.TestCase):
    """HTML minimo escrito a mano con la forma de cada tienda: valores exactos."""

    def test_gamingcity_precio_especial_alternativas_y_alt(self):
        html = ('<div class="product"><a href="memoria-kingston--det--123"><img alt="x"></a>'
                '<p class="titprod">Memoria Kingston Fury 16GB DDR4</p>'
                '<span class="price-sales">$ 45.990</span><span class="price-standard">$ 52.000</span></div>'
                '<div class="product"><a href="mouse-x--det--9"><img alt="Mouse &amp; Pad"></a>'
                '<div class="price"><span>$ 9.500</span></div></div>'
                '<div class="product"><a href="sin-precio--det--5">Sin precio</a></div>')
        items = indexar.tarjetas(html, TIENDAS["gamingcity"]["catalogo"])
        self.assertEqual(items, [
            {"url": "memoria-kingston--det--123", "nombre": "Memoria Kingston Fury 16GB DDR4",
             "precio": 45990, "lista": 52000},
            {"url": "mouse-x--det--9", "nombre": "Mouse & Pad", "precio": 9500, "lista": None},
        ])

    def test_mexx(self):
        html = ('<div class="productos col"><a href="https://www.mexx.com.ar/productos-rubro/memorias/'
                'kingston-16gb.html">Memoria Kingston 16GB</a><div class="price"><b>$45.000</b></div></div>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["mexx"]["catalogo"]), [
            {"url": "https://www.mexx.com.ar/productos-rubro/memorias/kingston-16gb.html",
             "nombre": "Memoria Kingston 16GB", "precio": 45000, "lista": None}])

    def test_fullh4rd(self):
        html = ('<article class="results-card"><h3 class="results-card__title">'
                '<a href="/prod/123/ssd-kingston-1tb">SSD Kingston 1TB</a></h3>'
                '<span class="results-card__price-current">$89.999</span>'
                '<span class="results-card__price-list">$99.999</span></article>')
        self.assertEqual(indexar.tarjetas(html, TIENDAS["fullh4rd"]["catalogo"]), [
            {"url": "/prod/123/ssd-kingston-1tb", "nombre": "SSD Kingston 1TB",
             "precio": 89999, "lista": 99999}])


class TarjetasReales(unittest.TestCase):
    """El HTML guardado de cada tienda con la configuracion real de tiendas.json."""

    PATRONES = {"gamingcity": r"^[a-z0-9-]+--det--\d+$",
                "mexx": r"^https://www\.mexx\.com\.ar/productos-rubro/.+\.html$",
                "fullh4rd": r"^/prod/\d+/[a-z0-9-]+$"}

    def test_listados_guardados(self):
        for clave, patron in self.PATRONES.items():
            with self.subTest(clave):
                html = leer(clave, "listado.html")
                items = indexar.tarjetas(html, TIENDAS[clave]["catalogo"])
                self.assertEqual(len(items), 4)
                for it in items:
                    self.assertRegex(it["url"], patron)
                    self.assertGreater(len(it["nombre"]), 3)
                    self.assertNotRegex(it["nombre"], r"[<>]|&[a-z]+;")
                    self.assertGreaterEqual(it["precio"], 1000)
                    self.assertIn(miles(it["precio"]), html)


class Catalogos(unittest.TestCase):
    def test_compragamer_sintetico_arma_la_url_y_la_foto(self):
        filas = [{"id_producto": 7913, "nombre": "Auriculares Redragon Ares H120 PC", "precioEspecial": 21350,
                  "precioLista": 24990, "imagenes": [{"nombre": "b", "orden": 2}, {"nombre": "a", "orden": 1}]},
                 {"id_producto": 1, "nombre": "Solo lista", "precioEspecial": None, "precioLista": 5000},
                 {"id_producto": 2, "nombre": "", "precioEspecial": 10}]
        with mock.patch.object(indexar, "bajar", return_value=json.dumps(filas)):
            items = indexar.indexar_json(TIENDAS["compragamer"])
        self.assertEqual([i["url"] for i in items], [
            "https://compragamer.com/producto/Auriculares_Redragon_Ares_H120_PC_7913",
            "https://compragamer.com/producto/Solo_lista_1"])
        self.assertEqual([i["precio"] for i in items], [21350, 5000])
        self.assertTrue(items[0]["imagen"].endswith("_a-grn.jpg"))

    def test_compragamer_guardado(self):
        filas = json.loads(leer("compragamer", "catalogo.json"))
        with mock.patch.object(indexar, "bajar", return_value=json.dumps(filas)):
            items = indexar.indexar_json(TIENDAS["compragamer"])
        esperadas = [f for f in filas if (f.get("precioEspecial") or f.get("precioLista")) and f.get("nombre")]
        self.assertEqual(len(items), len(esperadas))
        for it, f in zip(items, esperadas):
            self.assertEqual(it["precio"], int(f.get("precioEspecial") or f.get("precioLista")))
            self.assertTrue(it["url"].startswith("https://compragamer.com/producto/"))
            self.assertTrue(it["url"].endswith("_" + str(f["id_producto"])))

    def test_comparaya_guardado(self):
        cuerpo = json.loads(leer("comparaya", "api.json"))

        def bajar(u):
            return json.dumps(cuerpo if "page=1&" in u else {"data": []})

        with mock.patch.object(indexar, "bajar", bajar), mock.patch.object(indexar.time, "sleep"):
            items = indexar.indexar_api(TIENDAS["comparaya"], 3)
        esperadas = [f for f in cuerpo["data"] if f.get("url") and f.get("price") and f.get("title")]
        self.assertEqual(len(items), len(esperadas))
        for it, f in zip(items, esperadas):
            self.assertEqual((it["url"], it["precio"], it["via"]), (f["url"], int(f["price"]), f.get("store_name")))
```

- [ ] **Step 4: Escribir `tests/test_actualizar.py`**

```python
import json
import unittest
from pathlib import Path
from unittest import mock

import actualizar

FIX = Path(__file__).resolve().parent / "fixtures"


def leer(clave, nombre):
    return (FIX / clave / nombre).read_text(encoding="utf-8")


def con_html(extractor, html):
    with mock.patch.object(actualizar, "bajar", return_value=html):
        return extractor({"url": "https://ejemplo.test/p"})


class Sinteticos(unittest.TestCase):
    def test_meta_de_gaming_city(self):
        html = ('<meta name="product:price:amount" content="236550.00"> Precio de lista $ 260.000 '
                '<meta name="product:availability" content="in stock">')
        self.assertEqual(con_html(actualizar.precio_meta, html),
                         {"precio": 236550, "precio_lista": 260000, "stock": "en stock"})

    def test_itemprop_de_mexx(self):
        self.assertEqual(con_html(actualizar.precio_itemprop, '<span itemprop="price" content="45000"> EN STOCK'),
                         {"precio": 45000, "stock": "en stock"})

    def test_og_de_fullh4rd(self):
        html = '<meta property="og:price:amount" content="89999"> Stock alto en la web'
        self.assertEqual(con_html(actualizar.precio_og, html), {"precio": 89999, "stock": "stock alto"})

    def test_sin_metadato_es_lookup_error(self):
        for extractor in (actualizar.precio_meta, actualizar.precio_itemprop, actualizar.precio_og):
            with self.subTest(extractor.__name__), self.assertRaises(LookupError):
                con_html(extractor, "<html>nada</html>")


class Reales(unittest.TestCase):
    def test_paginas_guardadas(self):
        casos = {"gamingcity": actualizar.precio_meta, "mexx": actualizar.precio_itemprop,
                 "fullh4rd": actualizar.precio_og}
        for clave, extractor in casos.items():
            with self.subTest(clave):
                html = leer(clave, "producto.html")
                r = con_html(extractor, html)
                self.assertIsInstance(r["precio"], int)
                self.assertGreaterEqual(r["precio"], 1000)
                self.assertIn(str(r["precio"]), html)
                self.assertRegex(r["stock"], r"^(en stock|sin stock|stock (alto|medio|bajo))$")

    def test_catalogo_compragamer_guardado(self):
        filas = json.loads(leer("compragamer", "catalogo.json"))
        actualizar._cache_cg.clear()
        self.addCleanup(actualizar._cache_cg.clear)
        with mock.patch.object(actualizar, "bajar", return_value=json.dumps(filas)):
            for f in filas:
                r = actualizar.precio_compragamer({"fuente": {"id_producto": f["id_producto"]}})
                self.assertEqual(r["precio"], f.get("precioEspecial"))
                self.assertEqual(r["stock"], "en stock" if (f.get("stock") or 0) > 0 else "sin stock")

    def test_producto_que_no_esta_en_el_catalogo(self):
        actualizar._cache_cg.clear()
        self.addCleanup(actualizar._cache_cg.clear)
        with mock.patch.object(actualizar, "bajar", return_value="[]"), self.assertRaises(LookupError):
            actualizar.precio_compragamer({"fuente": {"id_producto": 1}})
```

- [ ] **Step 5: Correr y ver que pasa.** Esta tarea prueba codigo que ya
  existe, asi que el rojo se comprueba rompiendo la regex a proposito.

Run: `python -m unittest discover -s tests -t . -v`
Expected: todos OK.

Despues, a modo de control, se cambia en `tiendas.json` la regex `precio` de
`mexx` por `"class=\"precio\""` y se vuelve a correr:
`TarjetasReales.test_listados_guardados (mexx)` y `TarjetasSinteticas.test_mexx`
tienen que fallar. Despues se vuelve atras con
`git checkout tiendas.json`.

- [ ] **Step 6: Commit**

```bash
git add tests/capturar.py tests/fixtures tests/test_indexar.py tests/test_actualizar.py
git commit -m "Tests de los extractores con HTML guardado de cada tienda"
```

---

### Task 5: Una sola fuente del HTML (F0.7) y `verificado` (F0.8 en el build)

**Files:**
- Modify: `actualizar.py`: constantes, `construir()`, `main()` y el docstring.
- Modify: `index.html` lineas 1-9: marcadores `solo-web` y descripcion fija.
- Modify: `.gitignore`: suma `comparativa-ram-ddr4-16gb.html`.
- Untrack: `comparativa-ram-ddr4-16gb.html` (`git rm --cached`).
- Test: `tests/test_build.py`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `actualizar.armar_artifact(html, leer) -> str`, donde
    `leer(ruta_relativa) -> str`;
  - `actualizar.construir(datos, pagina=INDICE, copia=COPIA, verificado=None) -> bool`;
  - las constantes `actualizar.COPIA`, `actualizar.JS_SRC` (regex con un grupo
    para la ruta `js/x.js`) y `actualizar.AR`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/test_build.py`:

```python
import json
import shutil
import tempfile
import unittest
from pathlib import Path

import actualizar

RAIZ = Path(__file__).resolve().parent.parent


class ArmarArtifact(unittest.TestCase):
    def test_saca_lo_que_solo_va_en_la_web_y_mete_los_scripts(self):
        html = ('<!doctype html>\n<html lang="es">\n<head>\n<!-- solo-web -->\n<meta charset="utf-8">\n'
                '<!-- /solo-web -->\n<title>T</title>\n<!-- solo-web -->\n<script id="gc" data-goatcounter="x"></script>\n'
                '<!-- /solo-web -->\n<style>a{}</style>\n</head>\n<body>\n<header>h</header>\n'
                '<div class="wrap">hola</div>\n<script src="js/uno.js"></script>\n'
                '<script>\nconst A = 1;\n</script>\n</body>\n</html>\n')
        copia = actualizar.armar_artifact(html, {"js/uno.js": "var UNO = 1;\n"}.__getitem__)
        self.assertTrue(copia.startswith("<title>T</title>"))
        for resto in ("solo-web", "doctype", "<html", "<head>", "</head>", "<body>", "</body>",
                      "</html>", "data-goatcounter", 'src="js/'):
            self.assertNotIn(resto, copia)
        for queda in ("<script>\nvar UNO = 1;\n</script>", "<style>a{}</style>", "<header>h</header>",
                      '<div class="wrap">hola</div>', "const A = 1;"):
            self.assertIn(queda, copia)


class Construir(unittest.TestCase):
    """construir() sobre una copia del index.html real."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        real = (RAIZ / "index.html").read_text(encoding="utf-8")
        (self.dir / "index.html").write_text(real, encoding="utf-8")
        for ruta in actualizar.JS_SRC.findall(real):
            destino = self.dir / ruta
            destino.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(RAIZ / ruta, destino)
        self.datos = json.loads((RAIZ / "datos.json").read_text(encoding="utf-8"))

    def construir(self, **kw):
        self.assertTrue(actualizar.construir(self.datos, pagina=self.dir / "index.html",
                                             copia=self.dir / "copia.html", **kw))
        return ((self.dir / "index.html").read_text(encoding="utf-8"),
                (self.dir / "copia.html").read_text(encoding="utf-8"))

    def test_inyecta_datos_en_index_y_arma_la_copia(self):
        self.datos["actualizado"] = "2099-01-02"
        pagina, copia = self.construir()
        self.assertIn('"actualizado": "2099-01-02"', pagina)
        self.assertIn('"actualizado": "2099-01-02"', copia)
        self.assertTrue(pagina.lower().startswith("<!doctype html>"))
        self.assertIn("<!-- solo-web -->", pagina)
        self.assertTrue(copia.startswith("<title>"))
        for resto in ('<script src="js/', "solo-web", "data-goatcounter", "og:image", "</head>"):
            self.assertNotIn(resto, copia)

    def test_verificado_va_al_html_y_no_a_los_datos(self):
        pagina, copia = self.construir(verificado="2026-10-08T15:25-03:00")
        self.assertIn('"verificado": "2026-10-08T15:25-03:00"', pagina)
        self.assertIn('"verificado": "2026-10-08T15:25-03:00"', copia)
        self.assertNotIn("verificado", self.datos)

    def test_sin_verificado_no_queda_uno_viejo(self):
        self.construir(verificado="2026-10-08T15:25-03:00")
        pagina, _ = self.construir()
        self.assertNotIn('"verificado"', pagina)

    def test_construir_dos_veces_da_lo_mismo(self):
        self.assertEqual(self.construir(), self.construir())
```

- [ ] **Step 2: Correr y ver que falla**

Run: `python -m unittest tests.test_build -v`
Expected: ERROR `module 'actualizar' has no attribute 'armar_artifact'`

- [ ] **Step 3: Cambiar `actualizar.py`**

1. **Docstring.** La linea `python actualizar.py --build    # reconstruye el HTML sin salir a la web`
   pasa a
   `python actualizar.py --build    # reinyecta datos.json en index.html y arma la copia del artifact`.
2. **Import.** `from datetime import date` pasa a
   `from datetime import date, datetime, timedelta, timezone`.
3. **Constantes.** `FUENTE = RAIZ / "comparativa-ram-ddr4-16gb.html"` pasa a
   `COPIA = RAIZ / "comparativa-ram-ddr4-16gb.html"   # la genera construir(), no se versiona`.
   Debajo de `CATALOGO_CG` va
   `AR = timezone(timedelta(hours=-3))   # Argentina no tiene horario de verano`.
4. **Construccion.** Toda la funcion `construir()` se cambia por:

```python
SOLO_WEB = re.compile(r"[ \t]*<!-- solo-web -->.*?<!-- /solo-web -->[ \t]*\n?", re.S)
ESQUELETO = re.compile(r"^[ \t]*(?:<!doctype html>|</?(?:html|head|body)\b[^>]*>)[ \t]*\n?", re.I | re.M)
JS_SRC = re.compile(r'<script src="(js/[\w.-]+\.js)"></script>')


def armar_artifact(html, leer):
    """La copia para el artifact: sin el esqueleto ni lo que solo sirve en la web
    (analitica, Open Graph), y con los scripts de js/ adentro, porque el artifact
    es un solo archivo y el visor le pone su propio <head>."""
    html = SOLO_WEB.sub("", html)
    html = ESQUELETO.sub("", html)
    html = JS_SRC.sub(lambda m: "<script>\n" + leer(m.group(1)).rstrip("\n") + "\n</script>", html)
    return html.lstrip()


def construir(datos, pagina=INDICE, copia=COPIA, verificado=None):
    """Inyecta datos.json en index.html y arma la copia del artifact.

    index.html es el unico HTML que se edita a mano. `verificado` es la hora del
    relevamiento: va al sitio publicado pero no a datos.json, asi el bot no
    commitea todos los dias aunque no cambie ningun precio."""
    if not pagina.exists():
        print(f"{ROJO}No encuentro {pagina.name}{FIN}")
        return False

    html = pagina.read_text(encoding="utf-8")
    publicados = dict(datos, verificado=verificado) if verificado else datos
    bloque = f"{INICIO}\nconst DATOS = {json.dumps(publicados, ensure_ascii=False, indent=1)};\n{FINAL}"
    patron = re.compile(re.escape(INICIO) + r".*?" + re.escape(FINAL), re.S)
    if not patron.search(html):
        print(f"{ROJO}No encuentro el bloque de datos en {pagina.name}{FIN}")
        return False
    html = patron.sub(lambda _: bloque, html)
    pagina.write_text(html, encoding="utf-8")
    copia.write_text(armar_artifact(html, lambda ruta: (pagina.parent / ruta).read_text(encoding="utf-8")),
                     encoding="utf-8")
    print(f"\n  {VERDE}{OK}{FIN} {pagina.name} y {copia.name} reconstruidos")
    return True
```

5. **`main()`.** La ultima llamada `construir(datos)` (despues de escribir
   `DATOS`) pasa a:

```python
    construir(datos, verificado=datetime.now(AR).isoformat(timespec="minutes"))
```

- [ ] **Step 4: Cambiar el `<head>` de `index.html`**

Las lineas 1 a 9 actuales (desde `<!doctype html>` hasta el `</style>` del
estilo base, antes de la linea vacia y de `<link rel="preconnect"`) se
cambian por:

```html
<!doctype html>
<html lang="es">
<head>
<!-- solo-web -->
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- /solo-web -->
<title>La Pichincha</title>
<!-- solo-web -->
<meta name="description" content="Comparador de hardware en Argentina: busca en 5 fuentes, arma la comparativa y te dice qué conviene comprar, no solo qué es más barato.">
<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font:14px system-ui,sans-serif;background:#fcfcfa}img{max-width:100%}[hidden]{display:none!important}</style>
<!-- /solo-web -->
```

- [ ] **Step 5: Sacar la copia del repo**

Se agrega `comparativa-ram-ddr4-16gb.html` al `.gitignore` y se corre:

```bash
git rm --cached comparativa-ram-ddr4-16gb.html
python actualizar.py --build
```

Expected: `index.html y comparativa-ram-ddr4-16gb.html reconstruidos`.
`git status` no muestra la copia. La copia empieza con `<title>La Pichincha</title>`.
`git diff index.html` muestra solo el cambio del `<head>`.

- [ ] **Step 6: Correr todos los tests**

Run: `python -m unittest discover -s tests -t . -v`
Expected: todos OK

- [ ] **Step 7: Commit**

```bash
git add actualizar.py index.html .gitignore tests/test_build.py
git commit -m "index.html es la unica fuente y la copia del artifact sale del build"
```

(El `git rm --cached` ya dejo la baja de la copia preparada para este commit).

---

### Task 6: `js/buscador.js` (F0.5 JS)

**Files:**
- Create: `js/buscador.js`
- Test: `tests/js/buscador.test.js`
- Modify: `index.html`: script nuevo y se borran las definiciones movidas.

**Interfaces:**
- Consumes: nada.
- Produces: `window.Buscador`, tambien disponible como
  `require("../../js/buscador.js")`, con:
  - `normal(t)`, `normalBusq(t)`, `esMedida(t)` y `filtroDe(q) -> (nombreNormalizado) => bool | null`;
  - `mediana(nums)`, `pisoDeGama(precio, niv, med)` y `ordenar(filas, med, orden, nivelMarca)`;
  - `armarMarcasRe(lista)`, `marcaDe(nombre, marcasRe, alias = ALIAS_MARCA)` y
    `ALIAS_MARCA`;
  - `specsDe(nombre)`, `motivoExclusion(n, nq, toks)` y `categoriaDe(nombre)`.

- [ ] **Step 1: Tomar la linea de base en el navegador, antes de tocar nada**

Con `preview_start {name: "web"}` y la pagina en `http://localhost:8765/#buscar`,
se espera a que cargue el indice y en `javascript_tool` se corre:

```js
await asegurarIndice();
JSON.stringify({ n: buscarTodo("ssd 1tb").length, n2: buscarTodo("2tb").length,
  picks: analizarConsulta("ddr4 16gb").picks.map(p => p.m.f[2]),
  orden: ordenar(buscarTodo("monitor 27"), 100000).slice(0, 5).map(f => f[2]) })
```

Se anota el resultado: es la referencia del Step 6.

- [ ] **Step 2: Escribir los tests que fallan**

`tests/js/buscador.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const B = require("../../js/buscador.js");

test("mediana con cantidad par, impar y vacia, sin tocar el original", () => {
  const nums = [4, 1, 3, 2];
  assert.equal(B.mediana([]), 0);
  assert.equal(B.mediana([3, 1, 2]), 2);
  assert.equal(B.mediana(nums), 2.5);
  assert.deepEqual(nums, [4, 1, 3, 2]);
});

test("normalBusq saca acentos y pega la cifra con su unidad", () => {
  assert.equal(B.normalBusq("Memoria 16 GB Ñandú 3200 MHz"), "memoria 16gb nandu 3200mhz");
});

test("una medida tiene que ser palabra entera", () => {
  const n = B.normalBusq;
  assert.equal(B.filtroDe("2tb")(n("Disco 12TB Seagate")), false);
  assert.equal(B.filtroDe("2tb")(n("Disco Seagate 2 TB")), true);
  assert.equal(B.filtroDe("27")(n("Monitor Vp227hf")), false);
  assert.equal(B.filtroDe("monitor 27")(n('Monitor Samsung 27" Curvo')), true);
  assert.equal(B.filtroDe("kingston")(n("Memoria KINGSTON Fury")), true);
  assert.equal(B.filtroDe("   "), null);
});

test("pisoDeGama es mas exigente sin marca reconocida", () => {
  assert.equal(B.pisoDeGama(400, 0, 1000), true);
  assert.equal(B.pisoDeGama(400, 2, 1000), false);
  assert.equal(B.pisoDeGama(300, 2, 1000), true);
});

test("ordenar por precio, por marca y recomendado", () => {
  const nivel = n => (/kingston/i.test(n) ? 2 : /hiksemi/i.test(n) ? 1 : 0);
  const filas = [["Generica 16GB", 300], ["Kingston 16GB", 900], ["Hiksemi 16GB", 800], ["Otra 16GB", 1000]];
  const nombres = r => r.map(f => f[0].split(" ")[0]);
  assert.deepEqual(nombres(B.ordenar(filas, 900, "precio", nivel)), ["Generica", "Hiksemi", "Kingston", "Otra"]);
  assert.deepEqual(nombres(B.ordenar(filas, 900, "marca", nivel)), ["Kingston", "Hiksemi", "Generica", "Otra"]);
  // Recomendado: primero la marca mas confiable, y al fondo el piso de gama (300 < 45% de 900).
  assert.deepEqual(nombres(B.ordenar(filas, 900, "recomendado", nivel)), ["Kingston", "Hiksemi", "Otra", "Generica"]);
  assert.equal(filas[0][0], "Generica 16GB");
});

test("la marca es la primera que aparece, con alias", () => {
  const re = B.armarMarcasRe(["intel", "hp", "kingston", "xpg", "western digital"]);
  assert.equal(B.marcaDe("Notebook HP Intel Core i5", re), "hp");
  assert.equal(B.marcaDe("Memoria XPG Gammix D35", re), "adata");
  assert.equal(B.marcaDe("Disco Western Digital Blue 1TB", re), "wd");
  assert.equal(B.marcaDe("Mouse generico", re), "");
});

test("specsDe lee lo que dice el nombre", () => {
  assert.deepEqual(B.specsDe("Memoria Kingston Fury DDR4 16GB 3200MHz CL16 RGB"),
    { Tipo: "DDR4", Capacidad: "16GB", Velocidad: "3200 MHz", Latencia: "CL16", Luces: "RGB" });
  assert.deepEqual(B.specsDe("SSD Kingston NV2 1TB M.2 NVMe"), { Capacidad: "1TB", Formato: "M.2 NVMe" });
  assert.deepEqual(B.specsDe('Monitor Samsung 27" 165Hz FHD'),
    { Pantalla: '27"', Refresco: "165 Hz", "Resolución": "FHD" });
});

test("motivoExclusion respeta lo que pide la busqueda", () => {
  const m = (nombre, q) => {
    const nq = B.normalBusq(q);
    return B.motivoExclusion(B.normalBusq(nombre), nq, nq.split(/\s+/).filter(Boolean));
  };
  assert.equal(m("SSD Kingston 480GB para notebook", "ssd 480gb"), null);
  assert.equal(m("Notebook Lenovo 16GB SSD 512GB", "ssd 512gb"), "equipos");
  assert.equal(m("Notebook Lenovo 16GB SSD 512GB", "notebook lenovo"), null);
  assert.equal(m("HD SSD 960GB Kingston SIMIL 1TB", "ssd 1tb"), "similares");
  assert.equal(m("Silla gamer simil cuero negra", "silla"), null);
  assert.equal(m("Cable SATA para SSD", "ssd"), "accesorios");
  assert.equal(m("Cable SATA para SSD", "cable sata"), null);
  assert.equal(m("Disco rigido WD Blue 1TB", "ssd 1tb"), "tipo");
  assert.equal(m("SSD Kingston A400 1TB", "disco rigido 1tb"), "tipo");
  assert.equal(m("Memoria Kingston 16GB SODIMM", "memoria 16gb"), "formato");
  assert.equal(m("Memoria Kingston 16GB SODIMM", "memoria sodimm 16gb"), null);
  assert.equal(m("Placa de video RTX 3060 outlet", "rtx 3060"), "usados");
});

test("categoriaDe es la primera palabra en singular", () => {
  assert.equal(B.categoriaDe("Auriculares Samsung Galaxy"), "auricular");
  assert.equal(B.categoriaDe("Monitores LG 27"), "monitor");
  assert.equal(B.categoriaDe("Memorias Kingston"), "memoria");
  assert.equal(B.categoriaDe("SSD Kingston"), "ssd");
  assert.equal(B.categoriaDe("Mouse Logitech"), "mouse");
});
```

- [ ] **Step 3: Correr y ver que falla**

Run: `node --test "tests/js/*.test.js"`
Expected: FAIL `Cannot find module '../../js/buscador.js'`

- [ ] **Step 4: Escribir `js/buscador.js`**

Se mueven las funciones tal como estan en `index.html`, salvo `ordenar` y
`marcaDe`, que reciben por parametro lo que hoy leen de variables globales. La
prueba de "palabra entera" pasa a `filtroDe`, que compila cada regex una sola
vez por consulta.

```js
/* Funciones puras del buscador: no tocan el DOM ni variables de la pagina.
   index.html las carga como script comun (quedan en window.Buscador) y los
   tests las cargan con require() desde Node: node --test "tests/js/*.test.js". */
(function (raiz) {
  "use strict";

  const normal = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  /* "1 TB" y "1TB" son lo mismo: se pegan la cifra y la unidad antes de comparar. */
  const pegarUnidades = t => t.replace(/(\d)\s+(gb|tb|mb|mhz|ghz|hz|w)\b/g, "$1$2");
  const normalBusq = t => pegarUnidades(normal(t));
  const esMedida = t => /^\d+(?:gb|tb|mb|mhz|ghz|hz|w|v)?$/.test(t);
  const escaparRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /* Que tiene que tener un nombre (ya pasado por normalBusq) para coincidir.
     Un numero, o un numero con su unidad (27, 1tb, 3200mhz), tiene que ser
     palabra entera: si no, "27" entra en "Vp227hf" y "2tb" en "12tb".
     Devuelve null si la consulta no tiene palabras. */
  function filtroDe(q) {
    const toc = normalBusq(q).split(/\s+/).filter(Boolean);
    if (!toc.length) return null;
    const pruebas = toc.map(t => {
      if (!esMedida(t)) return n => n.includes(t);
      const re = new RegExp("(^|[^0-9a-z])" + t + "([^0-9a-z]|$)");
      return n => re.test(n);
    });
    return n => pruebas.every(p => p(n));
  }

  function mediana(nums) {
    if (!nums.length) return 0;
    const o = [...nums].sort((a, b) => a - b), m = o.length >> 1;
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  }

  /* El piso de una marca buena casi nunca es la mejor compra: suele ser un modelo
     viejo o de entrada. Sin marca reconocida el umbral es mas exigente. */
  const pisoDeGama = (precio, niv, med) => precio < med * (niv === 0 ? 0.45 : 0.35);

  /* Ordena el resultado segun el criterio elegido. "recomendado" pone primero la
     marca mas confiable al menor precio, y manda al fondo lo que esta tan por
     debajo del resto que probablemente no sea comparable. */
  function ordenar(filas, med, orden, nivelMarca) {
    const copia = [...filas];
    if (orden === "precio") return copia.sort((a, b) => a[1] - b[1]);
    if (orden === "marca") return copia.sort((a, b) =>
      nivelMarca(b[0]) - nivelMarca(a[0]) || a[1] - b[1]);
    return copia.sort((a, b) => {
      const na = nivelMarca(a[0]), nb = nivelMarca(b[0]);
      const sa = pisoDeGama(a[1], na, med), sb = pisoDeGama(b[1], nb, med);
      return (sa - sb) || (nb - na) || (a[1] - b[1]);
    });
  }

  const ALIAS_MARCA = { xpg: "adata", gskill: "g.skill", tplink: "tp-link", "western digital": "wd" };
  const armarMarcasRe = lista => lista.map(m => [m, new RegExp("\\b" + escaparRe(m) + "\\b")]);

  /* La marca es la que aparece primero en el nombre: "Notebook HP Intel Core" es HP. */
  function marcaDe(nombre, marcasRe, alias = ALIAS_MARCA) {
    const n = normal(nombre);
    let mejor = "", pos = 1e9;
    for (const [m, re] of marcasRe) {
      const x = n.search(re);
      if (x >= 0 && x < pos) { pos = x; mejor = m; }
    }
    return alias[mejor] || mejor;
  }

  /* Lee del nombre del aviso lo que se pueda: el indice no tiene fichas tecnicas. */
  function specsDe(nombre) {
    const n = nombre.replace(/(\d),(\d)/g, "$1.$2");
    const s = {};
    let m;
    if ((m = n.match(/\bddr([345])\b/i))) s["Tipo"] = "DDR" + m[1];
    const caps = [...n.matchAll(/\b(\d{1,4})\s?(gb|tb)\b/gi)].map(x => x[1] + x[2].toUpperCase());
    if (caps.length) s["Capacidad"] = [...new Set(caps)].slice(0, 2).join(" + ");
    if ((m = n.match(/\b(\d{3,5})\s?mhz\b/i))) s["Velocidad"] = m[1] + " MHz";
    if ((m = n.match(/\bcl\s?(\d{2})\b/i))) s["Latencia"] = "CL" + m[1];
    if ((m = n.match(/\b(\d{3,4})\s?w\b/i))) s["Potencia"] = m[1] + " W";
    if ((m = n.match(/\b(\d{2}(?:\.\d)?)\s?(?:"|”|″|pulgadas|pulg\b)/i))) s["Pantalla"] = m[1] + '"';
    if ((m = n.match(/\b(\d{2,3})\s?hz\b/i))) s["Refresco"] = m[1] + " Hz";
    if ((m = n.match(/\b(4k|uhd|wqhd|qhd|2k|fhd|full\s?hd|1080p|1440p|720p)\b/i)))
      s["Resolución"] = /full/i.test(m[1]) ? "FHD" : m[1].toUpperCase();
    if ((m = n.match(/\b(\d{1,2})\s?(?:nucleos|núcleos|cores)\b/i))) s["Núcleos"] = m[1];
    if (/so-?dimm/i.test(n)) s["Formato"] = "SODIMM";
    else if (/nvme|\bm\.?2\b/i.test(n)) s["Formato"] = "M.2 NVMe";
    else if (/sata/i.test(n)) s["Formato"] = "SATA";
    if (/\bargb\b|\brgb\b/i.test(n)) s["Luces"] = "RGB";
    return s;
  }

  /* Avisos que no son comparables con el resto aunque coincidan con la busqueda,
     salvo que la propia busqueda los pida. */
  const REGLAS_EXCLUSION = [
    { id: "formato", re: /so-?dimm/, pide: /so-?dimm|notebook|laptop/ },
    // Un aviso que EMPIEZA con "Notebook", "PC" o "Combo" es un equipo completo: el
    // componente que buscas solo aparece de pasada. Anclado al inicio a proposito,
    // porque "SSD para notebook" si es un SSD.
    { id: "equipos", re: /^(notebook|laptop|netbook|pc\b|computadora|all in one|mini pc|combo|kit\b|equipo)/,
      pide: /notebook|laptop|netbook|\bpc\b|computadora|all in one|combo|armad|equipo|kit/ },
    { id: "usados", re: /outlet|usado|reacondicionad|refurb|open box|exhibicion/,
      pide: /outlet|usado|reacondicionad|refurb|open box|exhibicion/ },
  ];

  /* Lo que pediste tiene que ser lo que ves. "SIMIL 1TB" no es 1TB, "Cable para SSD"
     no es un SSD y un disco rigido no es un SSD. */
  const ACCESORIOS_INICIO = /^(carcasa|gabinete|caddy|adaptador|cable|dock|docking|funda|bolso|mochila|soporte|base|bracket)\b/;
  const ES_HDD = /^(hdd|hd\b(?!\s*(?:ssd|solido))|disco (?:rigido|duro|mecanico)|hard ?disk)/;
  const ES_SSD = /^(ssd|hd\s*ssd|disco solido|unidad solida)/;

  function motivoExclusion(n, nq, toks) {
    for (const r of REGLAS_EXCLUSION) if (r.re.test(n) && !r.pide.test(nq)) return r.id;
    // Si lo que buscas aparece justo despues de "simil", ese aviso dice que NO es eso.
    for (const t of toks) {
      if (new RegExp("\\bsimil(?:ar|es)?\\s+(?:a\\s+|al\\s+|de\\s+)?" + escaparRe(t)).test(n)) return "similares";
    }
    const a = n.match(ACCESORIOS_INICIO);
    if (a && !nq.includes(a[1])) return "accesorios";
    if (/\bssd\b|solido|nvme/.test(nq) && !/\bhdd\b|rigido|duro/.test(nq) && ES_HDD.test(n)) return "tipo";
    if (/\bhdd\b|rigido|disco duro|hard ?disk/.test(nq) && !/\bssd\b|solido/.test(nq) && ES_SSD.test(n)) return "tipo";
    return null;
  }

  /* "Auriculares Samsung..." -> "auricular": el rubro es la primera palabra, en singular. */
  function categoriaDe(nombre) {
    let w = normal(nombre).split(/\s+/)[0].replace(/[^a-z]/g, "");
    if (/(ores|ares|eres)$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 4 && w.endsWith("s")) w = w.slice(0, -1);
    return w;
  }

  const api = { normal, normalBusq, esMedida, filtroDe, mediana, pisoDeGama, ordenar,
                ALIAS_MARCA, armarMarcasRe, marcaDe, specsDe, motivoExclusion, categoriaDe };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Buscador = api;
})(this);
```

`specsDe`, `REGLAS_EXCLUSION` y `motivoExclusion` son copia literal de
`index.html` (lineas 2047-2100). El unico cambio es `escaparRe(t)` en lugar del
`replace` inline: no cambia ni una regla.

- [ ] **Step 5: Correr y ver que pasa**

Run: `node --test "tests/js/*.test.js"`
Expected: 9 tests pass

- [ ] **Step 6: Cablear `index.html`**

1. **Cargar el script.** Justo antes del `<script>` principal (el que abre con
   `/* === DATOS: generado por actualizar.py`) se agrega
   `<script src="js/buscador.js"></script>`.
2. **Desestructurar.** Despues de
   `const icono = n => ...;` se agrega:

```js

/* Funciones puras del buscador: viven en js/buscador.js, con sus tests. */
const { normal, normalBusq, mediana, pisoDeGama, specsDe, motivoExclusion, categoriaDe } = Buscador;
```

3. **Lo que se borra:**
   - la linea `const normal = t => t.toLowerCase()...` (cerca de la 1274);
   - la funcion `categoriaDe` con su comentario (cerca de la 1327);
   - desde `function mediana(nums) {` hasta el cierre de `buscarTodo`,
     incluidos `pisoDeGama`, `ordenar`, `pegarUnidades`, `normalBusq` y
     `esMedida`. En su lugar va:

```js
/* "Recomendado" pone primero la marca mas confiable al menor precio y manda al
   fondo el piso de gama. La logica vive en js/buscador.js. */
function ordenar(filas, med) { return Buscador.ordenar(filas, med, ORDEN, nivelMarca); }

function buscarTodo(q) {
  const coincide = Buscador.filtroDe(q);
  if (!IDX || !coincide) return [];
  // Los nombres normalizados se calculan una sola vez por indice cargado.
  const N = IDX._n || (IDX._n = IDX.productos.map(f => normalBusq(f[0])));
  const halla = [];
  IDX.productos.forEach((f, i) => { if (coincide(N[i])) halla.push(f); });
  return halla;
}
```

4. **Marcas.** Las lineas de `ALIAS_MARCA` y `MARCAS_RE` (cerca de la 2028) se
   cambian por
   `const MARCAS_RE = Buscador.armarMarcasRe([...(MARCAS.primera || []), ...(MARCAS.conocida || [])]);`
   y la funcion `marcaDe` por:

```js
/* La marca es la que aparece primero en el nombre: "Notebook HP Intel Core" es HP. */
function marcaDe(nombre) { return Buscador.marcaDe(nombre, MARCAS_RE); }
```

5. **Exclusiones.** Se borran `specsDe`, `REGLAS_EXCLUSION`,
   `ACCESORIOS_INICIO`, `ES_HDD`, `ES_SSD` y `motivoExclusion` con sus
   comentarios.

- [ ] **Step 7: Verificar en el navegador contra la linea de base**

Se recarga `http://localhost:8765/#buscar` y se corre el mismo snippet del
Step 1.
Expected: JSON identico al del Step 1. `read_console_messages` con
`onlyErrors` no trae nada. Buscar "ssd 1tb" a mano muestra resultados.

- [ ] **Step 8: Commit**

```bash
git add js/buscador.js tests/js/buscador.test.js index.html
git commit -m "Las funciones puras del buscador pasan a js/buscador.js con tests"
```

---

### Task 7: `js/pagina.js` (F0.5 JS: lo puro de F0.1, F0.2 y F0.8)

**Files:**
- Create: `js/pagina.js`
- Test: `tests/js/pagina.test.js`
- Modify: `index.html`: se agrega `<script src="js/pagina.js"></script>`
  despues del de buscador.

**Interfaces:**
- Consumes: nada.
- Produces: `window.Pagina`, tambien disponible con `require`, con:
  - `leerUrl(search, hash) -> {q, vista}` y `armarUrl(pathname, q, vista) -> string`;
  - `cuando(iso, ahora = new Date()) -> string`;
  - `comercioDeUrl(href) -> string`;
  - `eventoBusqueda(termino, n)`, `eventoClic(href, rubro)` y
    `eventoAccion(accion, vista)`. Los tres devuelven `{path, title, event: true} | null`.

- [ ] **Step 1: Escribir los tests que fallan**

`tests/js/pagina.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../../js/pagina.js");

test("leerUrl toma q y la vista", () => {
  assert.deepEqual(P.leerUrl("?q=ssd+1tb", "#comparativa"), { q: "ssd 1tb", vista: "comparativa" });
  assert.deepEqual(P.leerUrl("", ""), { q: "", vista: "" });
  assert.deepEqual(P.leerUrl("?q=%20a%20", "#buscar"), { q: "", vista: "buscar" });
  assert.deepEqual(P.leerUrl("?q=monitor%20%2027%22&utm_source=wa", ""), { q: 'monitor 27"', vista: "" });
  assert.equal(P.leerUrl("?q=" + "x".repeat(150), "").q.length, 100);
});

test("armarUrl escribe q y la vista solo si hay", () => {
  assert.equal(P.armarUrl("/la-pichincha/", "ssd 1tb", "comparativa"), "/la-pichincha/?q=ssd+1tb#comparativa");
  assert.equal(P.armarUrl("/la-pichincha/", "", "ofertas"), "/la-pichincha/#ofertas");
  assert.equal(P.armarUrl("/la-pichincha/", "  ", ""), "/la-pichincha/");
});

test("una consulta con caracteres raros va y vuelve intacta", () => {
  for (const q of ['monitor 27"', "placa de video & cía", "ssd 1tb #oferta", "100% algodón", "rtx 4060+ti"]) {
    const u = new URL("https://x.test" + P.armarUrl("/la-pichincha/", q, "veredicto"));
    assert.deepEqual(P.leerUrl(u.search, u.hash), { q, vista: "veredicto" });
  }
});

test("cuando habla en hora argentina", () => {
  const ahora = new Date("2026-10-08T18:00:00-03:00");
  assert.equal(P.cuando("2026-10-08T15:25-03:00", ahora), "hoy 15:25");
  assert.equal(P.cuando("2026-10-07T23:59-03:00", ahora), "ayer 23:59");
  assert.equal(P.cuando("2026-10-05T09:05-03:00", ahora), "5/10 09:05");
  // 22:00 del 7 en Argentina ya es el 8 en UTC: igual es "hoy" si alla todavia es el 7.
  assert.equal(P.cuando("2026-10-07T22:00-03:00", new Date("2026-10-08T02:00:00Z")), "hoy 22:00");
});

test("cuando con un indice viejo sin hora, o basura", () => {
  assert.equal(P.cuando("2026-10-07", new Date("2026-10-08T12:00:00-03:00")), "el 7/10");
  assert.equal(P.cuando("", new Date()), "");
  assert.equal(P.cuando(undefined, new Date()), "");
  assert.equal(P.cuando("basura", new Date()), "");
});

test("comercioDeUrl se queda con el dominio del comercio", () => {
  assert.equal(P.comercioDeUrl("https://www.mexx.com.ar/productos-rubro/x.html"), "mexx.com.ar");
  assert.equal(P.comercioDeUrl("https://articulo.mercadolibre.com.ar/MLA-123"), "mercadolibre.com.ar");
  assert.equal(P.comercioDeUrl("https://compragamer.com/producto/x"), "compragamer.com");
  assert.equal(P.comercioDeUrl("https://www.gamingcity.com.ar/a--det--1"), "gamingcity.com.ar");
  assert.equal(P.comercioDeUrl("mailto:x@y.com"), "");
  assert.equal(P.comercioDeUrl("no es url"), "");
});

test("eventoBusqueda separa las vacias y recorta el termino", () => {
  assert.deepEqual(P.eventoBusqueda("ssd 1tb", 45), { path: "busqueda/ssd 1tb", title: "45 resultados", event: true });
  assert.equal(P.eventoBusqueda("ssd 1tb", 1).title, "1 resultado");
  assert.deepEqual(P.eventoBusqueda("xyzzy", 0), { path: "busqueda_vacia/xyzzy", title: "sin resultados", event: true });
  assert.equal(P.eventoBusqueda("   ", 3), null);
  assert.equal(P.eventoBusqueda("a  b", 2).path, "busqueda/a b");
  assert.equal(P.eventoBusqueda("a".repeat(80), 2).path, "busqueda/" + "a".repeat(60));
});

test("eventoClic y eventoAccion", () => {
  assert.deepEqual(P.eventoClic("https://www.mexx.com.ar/p.html", "memoria"),
    { path: "clic_saliente/mexx.com.ar/memoria", title: "mexx.com.ar", event: true });
  assert.equal(P.eventoClic("https://www.mexx.com.ar/p.html", "").path, "clic_saliente/mexx.com.ar/otro");
  assert.equal(P.eventoClic("mailto:x@y.com", "a"), null);
  assert.deepEqual(P.eventoAccion("excel", "buscar"), { path: "exportar/excel/buscar", title: "buscar", event: true });
  assert.equal(P.eventoAccion("csv", "buscar").path, "exportar/csv/buscar");
  assert.equal(P.eventoAccion("imprimir", "ofertas").path, "exportar/imprimir/ofertas");
  assert.equal(P.eventoAccion("copiar", "comparativa").path, "compartir/copiar/comparativa");
  assert.equal(P.eventoAccion("compartir", "veredicto").path, "compartir/nativo/veredicto");
  assert.equal(P.eventoAccion("otra", "x"), null);
});
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node --test "tests/js/*.test.js"`
Expected: FAIL `Cannot find module '../../js/pagina.js'`

- [ ] **Step 3: Escribir `js/pagina.js`**

```js
/* Funciones puras de la pagina: la URL compartible, la hora en Argentina y
   los eventos de analitica. Sin DOM, para poder probarlas con node --test. */
(function (raiz) {
  "use strict";

  const ZONA = "America/Argentina/Buenos_Aires";
  const TOPE_Q = 100;          // un link no necesita mas para reproducir la busqueda
  const TOPE_TERMINO = 60;     // GoatCounter agrupa por path: mas largo no aporta

  /* ?q=ssd+1tb#comparativa -> { q: "ssd 1tb", vista: "comparativa" } */
  function leerUrl(search, hash) {
    const q = (new URLSearchParams(search || "").get("q") || "").replace(/\s+/g, " ").trim().slice(0, TOPE_Q);
    return { q: q.length >= 2 ? q : "", vista: (hash || "").replace(/^#/, "") };
  }

  function armarUrl(pathname, q, vista) {
    const t = (q || "").trim();
    return pathname + (t ? "?" + new URLSearchParams({ q: t }) : "") + (vista ? "#" + vista : "");
  }

  const formato = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, year: "numeric", month: "numeric",
    day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const partes = d => Object.fromEntries(formato.formatToParts(d).map(p => [p.type, p.value]));
  const diaDe = p => Date.UTC(+p.year, +p.month - 1, +p.day);

  /* "hoy 15:25", "ayer 15:25" o "7/10 15:25", siempre en hora argentina. Un
     indice viejo trae solo la fecha ("2026-10-07"): ahi dice "el 7/10". */
  function cuando(iso, ahora = new Date()) {
    if (!iso) return "";
    const solo = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (solo) return `el ${+solo[3]}/${+solo[2]}`;
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const a = partes(d), h = partes(ahora);
    const dias = Math.round((diaDe(h) - diaDe(a)) / 864e5);
    const hora = `${a.hour}:${a.minute}`;
    return dias === 0 ? `hoy ${hora}` : dias === 1 ? `ayer ${hora}` : `${+a.day}/${+a.month} ${hora}`;
  }

  /* El comercio es el dominio: articulo.mercadolibre.com.ar -> mercadolibre.com.ar */
  function comercioDeUrl(href) {
    let host = "";
    try { host = new URL(href).hostname.toLowerCase(); } catch (e) { return ""; }
    if (!host) return "";
    const p = host.replace(/^www\./, "").split(".");
    return p.slice(/\.(com|net|org|gob|edu|tur)\.ar$/.test(host) ? -3 : -2).join(".");
  }

  /* GoatCounter: el nombre del evento va en path y el detalle en title. */
  function eventoBusqueda(termino, n) {
    const t = (termino || "").replace(/\s+/g, " ").trim().slice(0, TOPE_TERMINO);
    if (!t) return null;
    return n > 0
      ? { path: "busqueda/" + t, title: n + (n === 1 ? " resultado" : " resultados"), event: true }
      : { path: "busqueda_vacia/" + t, title: "sin resultados", event: true };
  }

  function eventoClic(href, rubro) {
    const c = comercioDeUrl(href);
    return c ? { path: `clic_saliente/${c}/${rubro || "otro"}`, title: c, event: true } : null;
  }

  const ACCIONES = { compartir: ["compartir", "nativo"], copiar: ["compartir", "copiar"],
                     excel: ["exportar", "excel"], csv: ["exportar", "csv"], imprimir: ["exportar", "imprimir"] };

  function eventoAccion(accion, vista) {
    const a = ACCIONES[accion];
    return a ? { path: `${a[0]}/${a[1]}/${vista || "pagina"}`, title: vista || "", event: true } : null;
  }

  const api = { leerUrl, armarUrl, cuando, comercioDeUrl, eventoBusqueda, eventoClic, eventoAccion };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Pagina = api;
})(this);
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node --test "tests/js/*.test.js"`
Expected: 17 tests pass

- [ ] **Step 5: Cargar el script en `index.html` y comprobar la copia**

Despues de `<script src="js/buscador.js"></script>` se agrega
`<script src="js/pagina.js"></script>`. Despues se corren
`python actualizar.py --build` y
`python -m unittest tests.test_build -v`.
Expected: OK, y en la copia no queda ningun `src="js/`.

- [ ] **Step 6: Commit**

```bash
git add js/pagina.js tests/js/pagina.test.js index.html
git commit -m "URL compartible, hora argentina y eventos de analitica en js/pagina.js"
```

---

### Task 8: La busqueda va a la URL (F0.2)

**Files:**
- Modify: `index.html`: `marcarConsulta`, `aTexto`, la seccion de ruteo y el
  final de `arrancar`.

**Interfaces:**
- Consumes: `Pagina.leerUrl`, `Pagina.armarUrl`, y las funciones de pagina que
  ya existen (`asegurarIndice`, `fijarConsulta`, `limpiarConsulta`,
  `guardarHist`, `ir`, `aplicar` y `consultar`).
- Produces:
  - `sincronizarUrl()`, `enlaceActual() -> string`,
    `abrirConsultaDeUrl(q, vista)` y `alNavegar()` en el script principal;
  - un gancho, `registrarBusqueda(q)`, que la Tarea 9 define. En esta tarea
    queda como `function registrarBusqueda(q) {}` y la 9 lo completa.

- [ ] **Step 1: Captura de antes**

Se abre `http://localhost:8765/?q=ssd+1tb#comparativa` en el preview y se saca
una captura.
Expected (lo de hoy): muestra la comparativa curada de memorias e ignora `q`.

- [ ] **Step 2: Implementar**

1. **`marcarConsulta`.** Pasa a:

```js
function marcarConsulta() {
  const t = $(".tabs"); if (t) t.dataset.consulta = CONSULTA ? "1" : "0";
  sincronizarUrl();
}
```

2. **Bloque nuevo.** Va arriba de `/* --- Ruteo --- */`:

```js
/* --- La busqueda va a la URL ---------------------------------------------
   ?q= guarda la consulta activa y el hash la pestaña: un link copiado
   reproduce la vista. replaceState para no llenar el historial al tipear. */
function sincronizarUrl() {
  const destino = Pagina.armarUrl(location.pathname, CONSULTA, location.hash.slice(1));
  if (destino === location.pathname + location.search + location.hash) return;
  try { history.replaceState(history.state, "", destino); } catch (e) { /* Safari limita las llamadas */ }
}

/* El link de lo que estas mirando: en Buscar vale lo que esta escrito. */
function enlaceActual() {
  const q = CONSULTA || ($("#q") || {}).value || "";
  return location.origin + Pagina.armarUrl(location.pathname, q, location.hash.slice(1));
}

function registrarBusqueda(q) {}   // la completa la analitica (F0.1)

/* Abrir un link con ?q=: se baja el indice, se arma la consulta y se muestra
   la pestaña del link. Sin resultados va al buscador con el termino escrito. */
async function abrirConsultaDeUrl(q, vista) {
  $("#vista").innerHTML = `<p class="sub">Armando la comparación de «${esc(q)}»…</p>`;
  try { await asegurarIndice(); } catch (e) { return aplicar(vista); }
  fijarConsulta(q);
  registrarBusqueda(q);
  if (!ANALISIS) { ir("buscar", false); return consultar(q); }
  guardarHist(q);
  ir(vista || "comparativa", false);
}

/* Atras y Adelante pueden cambiar la consulta, no solo la pestaña. popstate y
   hashchange llegan juntos: se atiende una vez. */
let navegando = false;
function alNavegar() {
  if (navegando) return;
  navegando = true;
  setTimeout(async () => {
    navegando = false;
    const { q, vista } = Pagina.leerUrl(location.search, location.hash);
    if (q !== CONSULTA) {
      if (!q) limpiarConsulta();
      else { try { await asegurarIndice(); fijarConsulta(q); } catch (e) { /* queda el curado */ } }
    }
    aplicar(vista);
  }, 0);
}
```

3. **Navegacion.** `window.addEventListener("hashchange", () => aplicar(location.hash.slice(1)));`
   pasa a:

```js
window.addEventListener("hashchange", alNavegar);
window.addEventListener("popstate", alNavegar);
```

4. **Final de `arrancar()`.** `aplicar(location.hash.slice(1));` pasa a:

```js
  const inicio = Pagina.leerUrl(location.search, location.hash);
  if (inicio.q) abrirConsultaDeUrl(inicio.q, inicio.vista);
  else aplicar(inicio.vista);
```

5. **Link en `aTexto`.** La linea
   `` `\n\nLa Pichincha · ${location.origin}${location.pathname}`; `` pasa a
   `` `\n\nLa Pichincha · ${enlaceActual()}`; ``.

- [ ] **Step 3: Verificar en el navegador**

Con `http://localhost:8765/` en el preview:

1. `?q=ssd+1tb#comparativa` muestra "Comparativa: ssd 1tb" con picks.
   Captura.
2. `?q=ssd+1tb#veredicto` muestra el veredicto de esa busqueda.
3. `?q=zzzxxy#comparativa` va a Buscar con `zzzxxy` escrito y "sin
   resultados".
4. Escribir `rtx 4060` en Buscar deja `?q=rtx+4060#buscar` en la barra, sin
   entradas nuevas en el historial: `history.length` no crece mientras se
   tipea.
5. Tocar Comparativa y despues Atras vuelve a Buscar con `rtx 4060`. "Ver el
   análisis curado" saca `q` de la URL.
6. `#memorias` sigue andando y abre la comparativa.
7. Desde la comparativa, `aTexto(ANALISIS.picks.map(p => p.m.f), "t")` termina
   con `?q=rtx+4060#comparativa`.

`read_console_messages` con `onlyErrors` vacio. Captura de despues del caso 1.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "La busqueda va a la URL y un link con ?q= reproduce la vista"
```

---

### Task 9: Analitica con GoatCounter (F0.1)

**Files:**
- Modify: `index.html`: `<head>` (canonical y el tag), funciones de
  medicion, `consultar`, `compararConsulta` y el handler de `data-acc`.

**Interfaces:**
- Consumes: `Pagina.eventoBusqueda`, `Pagina.eventoClic`, `Pagina.eventoAccion`,
  `categoriaDe`, `normalBusq` y `buscarTodo`.
- Produces: `medir(evento)` y la version completa de `registrarBusqueda(q)`.

- [ ] **Step 1: El `<head>`**

Adentro del segundo bloque `solo-web`, debajo de la `meta description`:

```html
<link rel="canonical" href="https://luismarceloescudero-debug.github.io/la-pichincha/">
<script id="gc" data-goatcounter="https://mescudero.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
```

- [ ] **Step 2: Medicion en el script principal**

Debajo del bloque `/* --- La busqueda va a la URL` se reemplaza el gancho
vacio `function registrarBusqueda(q) {}` por:

```js
/* --- Analitica: GoatCounter, sin cookies ni banner ------------------------
   El script es async: lo que se mide antes de que cargue espera en una cola.
   Si un bloqueador lo frena, los eventos se pierden sin romper nada. */
const COLA_GC = [];
function vaciarCola() {
  const gc = window.goatcounter;
  if (!gc || typeof gc.count !== "function") return;
  while (COLA_GC.length) { try { gc.count(COLA_GC.shift()); } catch (e) { /* no frena la pagina */ } }
}
function medir(ev) { if (ev) { COLA_GC.push(ev); vaciarCola(); } }
(() => { const s = document.getElementById("gc"); if (s) s.addEventListener("load", vaciarCola); })();

/* Una busqueda cuenta cuando se asienta, no por cada tecla. */
let ULTIMO_MEDIDO = "";
function registrarBusqueda(q) {
  const t = normalBusq(q || "").replace(/\s+/g, " ").trim();
  if (t.length < 2 || t === ULTIMO_MEDIDO || !IDX) return;
  ULTIMO_MEDIDO = t;
  medir(Pagina.eventoBusqueda(t, buscarTodo(q).length));
}

/* Clic hacia una tienda: el comercio sale del dominio y el rubro del producto,
   buscado por URL en el indice o en los curados. */
let RUBROS = null;
function rubroDeUrl(url) {
  if (!RUBROS || RUBROS.idx !== IDX) {
    const m = new Map();
    P.forEach(p => m.set(p.url, /^ram/.test(p.tipo) ? "memoria" : /^webcam/.test(p.tipo) ? "webcam" : "otro"));
    if (IDX) IDX.productos.forEach(f => { if (!m.has(f[2])) m.set(f[2], categoriaDe(f[0]) || "otro"); });
    RUBROS = { idx: IDX, m };
  }
  return RUBROS.m.get(url) || "otro";
}
function alClicSaliente(ev) {
  if (ev.type === "auxclick" && ev.button !== 1) return;
  const a = ev.target.closest && ev.target.closest("a[href]");
  if (!a || !/^https?:$/.test(a.protocol) || a.host === location.host) return;
  medir(Pagina.eventoClic(a.href, rubroDeUrl(a.getAttribute("href"))));
}
document.addEventListener("click", alClicSaliente, true);
document.addEventListener("auxclick", alClicSaliente, true);
```

- [ ] **Step 3: Disparar los eventos**

1. **En `consultar`.**
   `guardarLuego = setTimeout(() => guardarHist(q), 1200);   // recien cuando dejas de tipear`
   pasa a:

```js
  guardarLuego = setTimeout(() => { guardarHist(q); registrarBusqueda(q); }, 1200);   // recien cuando dejas de tipear
```

2. **En `compararConsulta`.** Despues de `guardarHist(q);` se agrega
   `registrarBusqueda(q);`.
3. **En el handler de `data-acc`.** Va despues de
   `if (!m.filas.length) return avisar(b, "nada para exportar");`.
   - Al lado de cada accion se agrega
     `medir(Pagina.eventoAccion("<accion>", b.dataset.de));`.
   - En el `try` del Excel va `"excel"`, despues del `await bajarArchivo`.
   - En el `catch` del Excel va `"csv"`.
   - En `imprimir`, `copiar` y `compartir` va su propio nombre.

   El bloque queda:

```js
  if (b.dataset.acc === "excel") {
    const previo = b.innerHTML;
    b.innerHTML = `${icono("tabla")} armando…`;
    try {
      await cargarExcel();
      b.innerHTML = previo;
      await bajarArchivo(`${base}.xlsx`, await aXLSX(m.filas, m.titulo),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b);
      medir(Pagina.eventoAccion("excel", b.dataset.de));
    } catch (e) {                      // sin CDN no hay libro, pero el CSV sirve igual
      b.innerHTML = previo;
      await bajarArchivo(`${base}.csv`, aCSV(m.filas), "text/csv;charset=utf-8", b);
      medir(Pagina.eventoAccion("csv", b.dataset.de));
    }
  }
  else if (b.dataset.acc === "imprimir") { medir(Pagina.eventoAccion("imprimir", b.dataset.de)); window.print(); }
  else if (b.dataset.acc === "copiar") { medir(Pagina.eventoAccion("copiar", b.dataset.de)); copiar(aTexto(m.filas, m.titulo), b); }
  else { medir(Pagina.eventoAccion("compartir", b.dataset.de)); compartir(m.titulo, aTexto(m.filas, m.titulo), b); }
```

- [ ] **Step 4: Verificar con un GoatCounter de mentira**

GoatCounter no manda nada desde `localhost`. Con el preview abierto en
`http://localhost:8765/#buscar` se corre en `javascript_tool`:

```js
window.__ev = []; window.goatcounter = { count: e => window.__ev.push(e.path) };
```

Despues se ejercita:

1. tipear `ssd 1tb` y esperar 1,5 s;
2. tipear `zzzxxy` y esperar 1,5 s;
3. clic en el primer resultado (el `target=_blank` abre una pestaña, se cierra
   con `tabs_close`);
4. clic en Copiar;
5. abrir `?q=rtx+4060#comparativa` (recargando y volviendo a instalar el doble
   antes del `load`; alcanza con correr el snippet y llamar a
   `abrirConsultaDeUrl("rtx 4060", "comparativa")`).

Se lee `window.__ev`.

Expected (el orden puede variar):

- `busqueda/ssd 1tb`
- `busqueda_vacia/zzzxxy`
- `clic_saliente/<dominio>/<rubro>`
- `compartir/copiar/buscar`
- `busqueda/rtx 4060`

**Con el script bloqueado.** Se recarga la pagina con la peticion a
`gc.zgo.at` fallando: se cambia temporalmente el `src` por
`https://gc.zgo.at/no-existe.js`, sin commitear. Se busca y se hace clic.
`read_console_messages` con `onlyErrors` no trae errores de la pagina; solo
aparece el 404 del recurso. Despues se vuelve a poner el `src` real.

- [ ] **Step 5: Correr los tests del build**

Run: `python actualizar.py --build && python -m unittest tests.test_build -v`
Expected: OK. La copia no trae `data-goatcounter` ni el canonical.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Analitica sin cookies con GoatCounter: busquedas, clics salientes, compartir y exportar"
```

---

### Task 10: Hora real de la ultima actualizacion en pantalla (F0.8)

**Files:**
- Modify: `index.html`: `pintarResultados` (estado vacio), `pintarOfertas`
  (sin ofertas) y `arrancar` (sello).

**Interfaces:**
- Consumes: `Pagina.cuando`, `IDX.generado` y `DATOS.verificado` (opcional).
- Produces: nada.

- [ ] **Step 1: Captura de antes**

En el preview: el sello de arriba y Buscar sin consulta (la linea "8.506
productos indexados ... actualizado 2026-10-07").

- [ ] **Step 2: Implementar**

1. **`pintarResultados`.** `` · actualizado ${IDX.generado}` `` pasa a
   `` · actualizado ${Pagina.cuando(IDX.generado)}` ``.
2. **`pintarOfertas`.** El texto del caso sin ofertas pasa a:

```js
                              : `<p class="sub">Volvé mañana: el índice se rearma una vez por día. El último relevamiento fue ${Pagina.cuando(IDX.generado)}.</p>`;
```

3. **`arrancar`.** La linea del sello pasa a:

```js
  $("#sello").textContent = (DATOS.verificado
    ? `Precios verificados en cada sitio ${Pagina.cuando(DATOS.verificado)}`
    : `Precios verificados en cada sitio · actualizado ${DATOS.actualizado}`) + ` · ${P.length} productos seguidos`;
```

- [ ] **Step 3: Verificar**

1. **Indice viejo.** Con el `indice.json` local de hoy, que no trae hora,
   Buscar sin consulta dice "actualizado el 7/10" y no "Invalid Date".
2. **Indice con hora.** Se rearma el indice local con hora real refrescando
   una sola fuente; las demas se conservan del indice anterior:
   `python indexar.py --solo mexx --max-paginas 1 --historial <scratchpad>/h`.
   Despues se recarga Buscar: tiene que decir "actualizado hoy HH:MM".
3. **Sello.** Sin `verificado` (el build local) muestra el texto de siempre.
   El sello se pinta una sola vez en `arrancar()`, asi que la variante con
   hora se prueba construyendo con hora:
   `python -c "import json,actualizar; d=json.load(open('datos.json',encoding='utf-8')); actualizar.construir(d, verificado='2026-10-08T15:25-03:00')"`.
   Se recarga, el sello dice "Precios verificados en cada sitio hoy 15:25",
   y despues se vuelve con `python actualizar.py --build`.
4. **Capturas de despues:** el sello y la linea de Buscar.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "La pagina muestra la hora real del ultimo relevamiento"
```

---

### Task 11: Open Graph y Twitter Card (F0.3)

**Files:**
- Create: `docs/og-imagen.html`
- Create: `img/og.png`
- Modify: `index.html`: tags en el segundo bloque `solo-web`.

**Interfaces:**
- Consumes: nada.
- Produces: `img/og.png` de 1200x630, publicado en `/la-pichincha/img/og.png`.

- [ ] **Step 1: Escribir `docs/og-imagen.html`**

```html
<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Imagen para compartir</title>
<!-- Fuente de img/og.png (1200x630). Para regenerarla, desde la raiz del repo:
     "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --hide-scrollbars
       --window-size=1200,630 --virtual-time-budget=4000 --screenshot=<ruta absoluta>\img\og.png
       <ruta absoluta>\docs\og-imagen.html
     Sin numeros que se vuelvan viejos: la imagen queda cacheada en WhatsApp. -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@500;700&display=swap">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  body { font-family: "IBM Plex Sans", system-ui, sans-serif; background: #f4f6f9; color: #14181f; display: flex; }
  .tarjeta { margin: 44px; flex: 1; background: #fff; border: 1px solid #d9dfe8; border-radius: 28px;
             padding: 54px 64px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
  .marca { font: 600 22px "IBM Plex Mono", monospace; color: #0b4fd8; letter-spacing: .08em; text-transform: uppercase; }
  h1 { font-size: 100px; line-height: 1; margin: 20px 0 0; letter-spacing: -.02em; }
  p { font-size: 34px; line-height: 1.25; color: #4e5767; margin: 22px 0 0; max-width: 640px; }
  .fuentes { margin-top: auto; display: flex; gap: 12px; flex-wrap: wrap; }
  .f { font: 600 21px "IBM Plex Mono", monospace; padding: 10px 18px; border-radius: 999px; }
  .barras { position: absolute; right: 64px; top: 70px; display: flex; align-items: flex-end; gap: 14px; height: 250px; }
  .barras span { width: 40px; border-radius: 10px 10px 4px 4px; background: #e3ecff; }
  .barras span.si { background: #0b4fd8; }
</style></head>
<body><div class="tarjeta">
  <div class="barras"><span style="height:62%"></span><span style="height:88%"></span><span class="si" style="height:40%"></span><span style="height:74%"></span><span style="height:100%"></span></div>
  <div class="marca">Comparador de hardware · Argentina</div>
  <h1>La Pichincha</h1>
  <p>No lo más barato: lo que más rinde. La mejor compra y dónde conviene.</p>
  <div class="fuentes">
    <span class="f" style="background:#efe9ff;color:#6534e8">CompraGamer</span>
    <span class="f" style="background:#d8f2f2;color:#0b7f80">Gaming City</span>
    <span class="f" style="background:#fbeeda;color:#a85a07">Mexx</span>
    <span class="f" style="background:#e7eaf0;color:#4e5767">FullH4rd</span>
    <span class="f" style="background:#fbe4ee;color:#b0265f">ComparaYa</span>
  </div>
</div></body></html>
```

- [ ] **Step 2: Renderizar y comprobar la imagen**

Se corre el comando del comentario con rutas absolutas, desde PowerShell. Despues
se mide:

```bash
python -c "import struct;b=open('img/og.png','rb').read();print(struct.unpack('>II',b[16:24]),len(b)//1024,'KB')"
```

Expected: `(1200, 630)` y menos de 300 KB. Se mira la imagen con `Read`: el
texto no se tiene que pisar con las barras y la tipografia tiene que ser IBM
Plex. Si salio `system-ui` porque no cargaron las fuentes, se sube
`--virtual-time-budget` a 8000.

- [ ] **Step 3: Tags en `index.html`**

En el segundo bloque `solo-web`, debajo del canonical (si la Tarea 9 todavia
no corrio, debajo de la `meta description`):

```html
<meta property="og:type" content="website">
<meta property="og:site_name" content="La Pichincha">
<meta property="og:locale" content="es_AR">
<meta property="og:title" content="La Pichincha · hardware en Argentina">
<meta property="og:description" content="Busca en 5 fuentes de Argentina y te dice qué conviene comprar: la mejor compra, la más barata y dónde, con los precios del día.">
<meta property="og:url" content="https://luismarceloescudero-debug.github.io/la-pichincha/">
<meta property="og:image" content="https://luismarceloescudero-debug.github.io/la-pichincha/img/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="La Pichincha: comparador de hardware en Argentina, con CompraGamer, Gaming City, Mexx, FullH4rd y ComparaYa">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="La Pichincha · hardware en Argentina">
<meta name="twitter:description" content="Busca en 5 fuentes de Argentina y te dice qué conviene comprar: la mejor compra, la más barata y dónde, con los precios del día.">
<meta name="twitter:image" content="https://luismarceloescudero-debug.github.io/la-pichincha/img/og.png">
```

- [ ] **Step 4: Verificar**

```bash
python actualizar.py --build && python -m unittest tests.test_build -v
python -c "import re;h=open('index.html',encoding='utf-8').read();print(sorted(set(re.findall(r'(?:property|name)=\"((?:og|twitter):[a-z:]+)\"',h))))"
```

Expected: tests OK. Se listan las 14 claves `og:*`/`twitter:*`. La copia no
trae `og:`. Se muestra `img/og.png` al dueño.

- [ ] **Step 5: Commit**

```bash
git add docs/og-imagen.html img/og.png index.html
git commit -m "Open Graph y Twitter Card con imagen propia para compartir"
```

---

### Task 12: CI. Los tests corren antes de publicar (F0.5, F0.4 y F0.6 en la Action)

**Files:**
- Create: `.github/workflows/tests.yml`
- Modify: `.github/workflows/actualizar.yml`

**Interfaces:**
- Consumes: `python -m unittest ...`, `node --test ...`,
  `indexar.py --historial`, `salud.py` y la rama `historial`, que se crea en la
  Tarea 14.
- Produces: el job reusable `tests` y la cadena `tests` -> `construir` ->
  `publicar`.

- [ ] **Step 1: Escribir `.github/workflows/tests.yml`**

```yaml
name: Tests

# Corre en cada PR y, llamado desde actualizar.yml, antes de cada publicacion:
# si un test falla no se commitea ni se despliega nada.
on:
  pull_request:
  workflow_call:

permissions:
  contents: read

jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - uses: actions/setup-node@v4
        with:
          node-version: "22"

      - name: Tests de Python
        run: python -m unittest discover -s tests -t . -v

      - name: Tests de JS
        run: node --test "tests/js/*.test.js"
```

- [ ] **Step 2: Reescribir `.github/workflows/actualizar.yml`**

```yaml
name: Actualizar precios y publicar

# El indice de busqueda no vive en el repo: se arma aca y viaja directo al
# despliegue. En main se versiona datos.json; el historial de precios del
# indice vive en la rama huerfana `historial`, un CSV por mes.

on:
  schedule:
    - cron: "0 12 * * *"        # 09:00 en Argentina (GitHub suele atrasarlo)
  workflow_dispatch:
    inputs:
      paginas:
        description: "Paginas por categoria al indexar"
        default: "12"
      indexar:
        description: "Rearmar el indice de busqueda"
        type: boolean
        default: true
  push:
    branches: [main]
    paths-ignore:
      - "README.md"
      - "**/*.md"

permissions:
  contents: write
  pages: write
  id-token: write
  issues: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  tests:
    uses: ./.github/workflows/tests.yml

  construir:
    needs: tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # El historial vive en su propia rama y no en la cache de Actions, que
      # GitHub puede desalojar.
      - name: Traer el historial de precios
        uses: actions/checkout@v4
        with:
          ref: historial
          path: historial

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Relevar precios de los productos seguidos
        run: python actualizar.py

      # Se commitea solo si cambio algun precio: la hora de verificacion va
      # estampada en el sitio publicado, no en el repo.
      - name: Guardar los cambios de precio
        if: github.event_name != 'push'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          if git diff --quiet datos.json; then
            echo "sin cambios de precio"
          else
            git add datos.json index.html
            git commit -m "Actualizacion automatica de precios [skip ci]"
            git push
          fi

      # Si una tienda se cae o bloquea la IP del runner, el indice anterior
      # sigue sirviendo en lugar de publicar el sitio sin buscador.
      # La clave incluye el hash del indexador y de la configuracion de fuentes:
      # si cambia el formato del indice o se suma una tienda, no hay cache que
      # reusar y el paso siguiente rearma el indice solo.
      - name: Recuperar el indice anterior
        uses: actions/cache@v4
        with:
          path: indice.json
          key: indice-${{ hashFiles('indexar.py', 'tiendas.json') }}-${{ github.run_id }}
          restore-keys: indice-${{ hashFiles('indexar.py', 'tiendas.json') }}-

      # Relevar los 5 catalogos son ~17 minutos. En un push a main no hace falta:
      # alcanza con reusar el indice de la cache, salvo que no haya ninguno.
      - name: Armar el indice de busqueda
        id: indexar
        if: |
          (github.event_name == 'schedule') ||
          (github.event_name == 'workflow_dispatch' && inputs.indexar) ||
          (github.event_name == 'push' && hashFiles('indice.json') == '')
        run: python indexar.py --max-paginas ${{ inputs.paginas || 12 }} --historial historial
        continue-on-error: true

      # Una corrida manual con menos paginas no escribe historia: veria como
      # bajas los productos que no llego a recorrer.
      - name: Guardar el historial de precios
        if: steps.indexar.outcome == 'success' && (inputs.paginas || '12') == '12'
        working-directory: historial
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          if git diff --cached --quiet; then
            echo "sin cambios en el historial"
          else
            git commit -m "Precios del $(TZ=America/Argentina/Buenos_Aires date +%F)"
            git push
          fi

      - name: Avisar si una fuente se cayo
        if: github.event_name == 'schedule' && steps.indexar.outcome != 'skipped'
        env:
          GH_TOKEN: ${{ github.token }}
        run: python salud.py salud.json

      - name: Preparar el sitio
        run: |
          mkdir -p _sitio
          cp index.html _sitio/
          cp -r img js _sitio/
          if [ -f indice.json ]; then
            cp indice.json _sitio/
            echo "indice: $(du -h indice.json | cut -f1)"
          else
            echo "::warning::Sin indice.json: el buscador va a quedar vacio en esta publicacion"
          fi

      - uses: actions/upload-pages-artifact@v3
        with:
          path: _sitio

  publicar:
    needs: construir
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.desplegar.outputs.page_url }}
    steps:
      - id: desplegar
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Revisar el diff**

No hay parser YAML en stdlib y no se suma una dependencia para esto. La
validacion real la hace GitHub en el PR (Tarea 14): si un workflow es
invalido, la pestaña Actions lo marca y no corre el job. Antes de commitear se
relee `git diff .github/` mirando la indentacion. Ademas se comprueba que lo
que llama el workflow existe:

```bash
python indexar.py --help | grep -- --historial
python salud.py --help
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/tests.yml .github/workflows/actualizar.yml
git commit -m "CI: tests antes de publicar, historial en su rama y aviso de fuentes caidas"
```

---

### Task 13: README

**Files:**
- Modify: `README.md`

**Interfaces:** ninguna.

- [ ] **Step 1: Actualizar las secciones**

1. **Tabla "Archivos".** Pasa a:

```markdown
| Archivo | Que es |
| --- | --- |
| `index.html` | La pagina que sirve GitHub Pages, y el unico HTML que se edita a mano |
| `js/` | Funciones puras del buscador (`buscador.js`) y de la pagina (`pagina.js`), con tests |
| `comparativa-ram-ddr4-16gb.html` | Copia para el artifact, sin `<head>` y en un solo archivo. La arma `python actualizar.py --build` y no se versiona |
| `historial.py` | Historial de precios del indice, en la rama `historial` |
| `salud.py` | Abre un issue cuando una fuente trae menos del 70% de lo que traia |
| `tests/` | Tests de Python (`unittest`) y de JS (`node --test`) |
| `img/` | Fotos oficiales de producto, optimizadas, y `og.png` para compartir |
| `docs/og-imagen.html` | Fuente de `img/og.png` |
```

2. **"Actualizar los precios".**
   - `python actualizar.py --build    # reconstruye el HTML sin salir a la web`
     pasa a
     `python actualizar.py --build    # reinyecta datos.json en index.html y arma la copia del artifact`.
   - "reinyecta todo en los dos HTML" pasa a "reinyecta todo en `index.html`
     y arma la copia del artifact".

3. **"Como se publica".** La lista numerada pasa a:

```markdown
1. Corren los tests. Si alguno falla, no se commitea ni se publica nada.
2. `actualizar.py` releva los precios de los productos seguidos y, si cambio
   alguno, commitea `datos.json` e `index.html`. La hora del relevamiento va
   estampada en el sitio publicado.
3. `indexar.py` arma el indice de busqueda, compara contra el historial y
   commitea los cambios de precio en la rama `historial`.
4. En la corrida programada, `salud.py` abre un issue (etiqueta `salud-fuente`)
   por cada fuente que trajo menos del 70% de lo que tenia, o comenta el que ya
   estaba abierto.
5. El sitio se sube como artefacto de Pages, sin tocar el repo.
```

4. **"Ofertas", seccion "Bajaron de precio".** El parrafo que empieza con
   "Bajaron de precio es la señal propia" pasa a decir que la comparacion es
   contra el historial de la rama `historial`. El parrafo "Esa foto vive en su
   propia cache de GitHub Actions..." se cambia por:

```markdown
El historial vive en la rama huerfana `historial`: un CSV por mes
(`2026-10.csv`) con columnas `fecha,tienda,id,precio`, donde `id` es la URL del
producto. Solo se escriben los cambios: cuando un producto aparece, cuando
cambia de precio y, con el precio vacio, cuando deja de publicarse. No depende
de la cache de Actions, asi que no se pierde si GitHub la borra, y no ensucia
`main`. Para tenerlo en tu maquina: `git worktree add historial historial`.

Una fuente que trae menos del 70% de lo que tenia no registra bajas ese dia:
asi una tienda que bloquea a medias no borra su catalogo del historial.
```

5. **"Exportar y compartir".** Debajo de la tabla se agrega:

```markdown
La busqueda va en la URL: `?q=ssd+1tb#comparativa` abre directo la comparativa
de esa busqueda, y Compartir y Copiar mandan ese link. Al pegarlo en WhatsApp
sale la tarjeta con titulo, descripcion e imagen (`img/og.png`).
```

6. **Secciones nuevas al final.**

```markdown
## Tests

    python -m unittest discover -s tests -t . -v
    node --test "tests/js/*.test.js"

Corren en cada PR y antes de cada publicacion. Los de los extractores usan HTML
guardado de cada tienda en `tests/fixtures/` y no salen a la red. Cuando una
tienda cambia su plantilla (llega el issue de `salud-fuente`):

    python tests/capturar.py mexx      # baja el HTML nuevo
    python -m unittest tests.test_indexar tests.test_actualizar

El test que falla dice que regex de `tiendas.json` hay que corregir.

## Analitica

GoatCounter, sin cookies ni banner: https://mescudero.goatcounter.com. Ademas de
las visitas mide estos eventos:

| Evento | Ejemplo | Cuando |
| --- | --- | --- |
| `busqueda` | `busqueda/ssd 1tb` | una busqueda con resultados, cuando dejas de tipear |
| `busqueda_vacia` | `busqueda_vacia/xyz` | una busqueda sin resultados: lo que falta en el indice |
| `clic_saliente` | `clic_saliente/mexx.com.ar/memoria` | un clic hacia una tienda: la metrica norte |
| `compartir` | `compartir/copiar/comparativa` | Compartir o Copiar |
| `exportar` | `exportar/excel/buscar` | Excel, CSV o Imprimir |

Desde `localhost` no cuenta nada.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "README: historial, tests, analitica y link con la busqueda"
```

---

### Task 14: Rama `historial`, PR y CI en verde

**Files:**
- Create (rama `historial`): `2026-10.csv` y `LEEME.md`

**Interfaces:**
- Consumes: `historial.cambios` y `historial.escribir`, y el `indice.json`
  local del 2026-10-07.
- Produces: `origin/historial` y un PR de `f0-cimientos` contra `main`.

- [ ] **Step 1: Crear la rama huerfana como worktree**

```bash
git worktree add --orphan -b historial historial
```

- [ ] **Step 2: Sembrarla desde el indice local**

```bash
python -c "import json,historial; from pathlib import Path; i=json.loads(Path('indice.json').read_text(encoding='utf-8')); f=i['generado'][:10]; a={(r[3],r[2]):r[1] for r in i['productos']}; filas=historial.cambios({},a,set(),f); print(historial.escribir(Path('historial'),f,filas), len(filas))"
```

Expected: `historial\2026-10.csv 8390` aproximadamente (8.506 menos las URLs
repetidas dentro de una misma tienda).

`historial/LEEME.md`:

```markdown
# Historial de precios de La Pichincha

Lo escribe la Action de `main` despues de cada relevamiento. Un archivo por
mes, `AAAA-MM.csv`, con solo los cambios:

| Columna | Que es |
| --- | --- |
| `fecha` | Dia del relevamiento, en hora argentina |
| `tienda` | Clave de la fuente en `tiendas.json` |
| `id` | URL del producto |
| `precio` | Pesos, con IVA. Vacio: ese dia dejo de publicarse |

Para saber cuanto valia un producto un dia, se recorren los meses en orden y
gana la ultima fila de ese `(tienda, id)` hasta esa fecha. `historial.py` en
`main` hace exactamente eso.

El primer archivo arranca con la foto completa del indice del 2026-10-07.
```

- [ ] **Step 3: Commit y push de la rama**

```bash
git -C historial add -A
git -C historial commit -m "Historial de precios: foto del indice del 2026-10-07"
git -C historial push -u origin historial
```

- [ ] **Step 4: Correr todo una vez mas y subir la rama de trabajo**

```bash
python -m unittest discover -s tests -t . -v
node --test "tests/js/*.test.js"
git push -u origin f0-cimientos
gh pr create --base main --head f0-cimientos --title "Fase 0: cimientos" --body-file <archivo>
```

El cuerpo del PR resume F0.1 a F0.8, lo que necesita el OK del dueño y cierra
con la linea de Claude Code.

- [ ] **Step 5: Atar el PR y esperar CI**

Se llama a `mcp__ccd_pr__get_status` y, si no reporta el PR, a
`mcp__ccd_pr__bind_pr`. Se espera el evento de CI sin hacer polling.
Expected: job `tests` en verde.

---

### Task 15: Publicar y verificar el criterio de salida (con el OK del dueño)

**Files:** ninguno (operacion).

- [ ] **Step 1: Pedir el OK para mergear.** Es el unico punto donde se frena:
  mergear despliega el sitio.

- [ ] **Step 2: Mergear y seguir la publicacion**

```bash
gh pr merge f0-cimientos --rebase
gh run list --workflow "Actualizar precios y publicar" --limit 1
gh run watch <id> --exit-status
```

`gh run watch` corre en segundo plano. Como cambio `indexar.py`, cambio la
clave de la cache, asi que la primera publicacion rearma el indice (~17
minutos) y escribe el primer commit de historia.

- [ ] **Step 3: Verificar el sitio publicado**

1. `curl -s https://luismarceloescudero-debug.github.io/la-pichincha/ | grep -c 'og:'`
   da 10 o mas, y `img/og.png` y `js/pagina.js` responden 200.
2. En el navegador integrado se abre
   `https://luismarceloescudero-debug.github.io/la-pichincha/?q=ssd+1tb#comparativa`:
   tiene que mostrar la comparativa de "ssd 1tb". Captura.
3. **Analitica.** En esa pestaña, `read_network_requests` con
   `urlPattern: "goatcounter.com/count"` muestra la visita y el evento
   `busqueda/ssd 1tb` con respuesta 2xx. Se hace un clic saliente y vuelve a
   aparecer. Al dueño se le avisa que esos hits son de prueba.
4. Las capturas de Buscar y del sello muestran la hora real.

- [ ] **Step 4: El historial sobrevive a borrar la cache**

```bash
gh cache list --key precios-
gh cache list --key precios- --json id --jq '.[].id' | xargs -n1 gh cache delete
gh workflow run "Actualizar precios y publicar"
```

La corrida manual usa las paginas por defecto.
Expected:

- el log del paso "Armar el indice" dice `N bajaron de precio segun el historial`;
- el paso "Guardar el historial de precios" hace `Precios del AAAA-MM-DD`;
- `git fetch origin historial && git log origin/historial --oneline` muestra
  el commit nuevo.

- [ ] **Step 5: Salud en seco**

Se fabrica un `salud.json` con una fuente al 10%
(`salud.evaluar({"mexx": 900}, {"mexx": 90}, {"mexx": "Mexx"}, "x")`) y se
corre `python salud.py <ruta> --seco`: imprime el issue que abriria. No se
abre un issue real, porque seria ruido publico.

- [ ] **Step 6: Informe final** al dueño, con los cuatro criterios de salida y
  su evidencia, y los pendientes.
