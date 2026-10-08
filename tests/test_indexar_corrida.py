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
