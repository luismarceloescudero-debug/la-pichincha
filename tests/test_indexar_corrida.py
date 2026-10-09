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

    def test_fuente_que_trae_cero_sin_excepcion_conserva_el_indice_anterior(self):
        # Asi se ve un bloqueo en los listados: cada pagina falla y se corta sin
        # excepcion. Sin esto la fuente desaparecia del sitio publicado.
        self.correr([(1, 1000), (2, 2000)], [(101, 500)])
        antes = len(self.filas())
        indice, salud = self.correr([], [(101, 500)])
        self.assertEqual(salud["fuentes"]["uno"]["estado"], "fallo")
        self.assertEqual(sorted(f[1] for f in indice["productos"] if f[3] == "uno"), [1000, 2000])
        self.assertEqual(len(self.filas()), antes)

    def test_las_filas_reusadas_conservan_la_foto_y_los_sellos(self):
        cfg = json.loads((self.dir / "tiendas.json").read_text(encoding="utf-8"))
        cfg["uno"]["catalogo"]["campos"]["imagen"] = "foto"
        cfg["uno"]["catalogo"]["sellos"] = {"i": "afuera"}
        (self.dir / "tiendas.json").write_text(json.dumps(cfg), encoding="utf-8")
        self.catalogos = {"https://uno.test/cat": [{"id": 1, "nombre": "Producto 1", "precio": 1000,
                                                    "foto": "https://img.test/1.jpg", "afuera": True}],
                          "https://dos.test/cat": [{"id": 101, "nombre": "Producto 101", "precio": 500}]}
        with redirect_stdout(io.StringIO()):
            indexar.main(["--historial", str(self.hist)])
            self.catalogos.pop("https://uno.test/cat")            # al dia siguiente uno se cae
            indexar.main(["--historial", str(self.hist)])
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        self.assertEqual(self.fila(indice, "uno", 1)[7:], ["https://img.test/1.jpg", "i", ""])
        self.assertEqual(self.fila(indice, "dos", 101)[8], "")
        self.assertTrue(all(len(f) == 10 for f in indice["productos"]))
        self.assertEqual(indice["campos"][-2:], ["sellos", "modelo"])

    def test_el_codigo_de_modelo_se_guarda_en_la_ultima_columna_tambien_en_filas_reusadas(self):
        nombre = "Disco Ssd 480Gb Kingston Sedc600M/480G"
        self.catalogos = {"https://uno.test/cat": [{"id": 1, "nombre": nombre, "precio": 1000},
                                                   {"id": 2, "nombre": "Producto 2", "precio": 1}],
                          "https://dos.test/cat": [{"id": 101, "nombre": "Producto 101", "precio": 500}]}
        with redirect_stdout(io.StringIO()):
            indexar.main(["--historial", str(self.hist)])
            self.catalogos.pop("https://uno.test/cat")            # uno se cae: sus filas se reusan
            indexar.main(["--historial", str(self.hist)])
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        modelos = {f[0]: f[9] for f in indice["productos"] if f[3] == "uno"}
        self.assertEqual(modelos, {nombre: "SEDC600M/480G", "Producto 2": ""})

    def test_el_sku_del_catalogo_agrupa_con_otra_tienda_que_lo_nombra(self):
        cfg = json.loads((self.dir / "tiendas.json").read_text(encoding="utf-8"))
        cfg["uno"]["catalogo"]["campos"]["sku"] = "codigo_principal"
        (self.dir / "tiendas.json").write_text(json.dumps(cfg), encoding="utf-8")
        self.catalogos = {
            "https://uno.test/cat": [{"id": 1, "nombre": "Disco Solido SSD Kingston 480GB A400 SATA", "precio": 1000,
                                      "codigo_principal": ["SKU: SA400S37/480G"]}],
            "https://dos.test/cat": [{"id": 101, "nombre": "HD SSD 480GB KINGSTON A400 SA400S37/480G", "precio": 900},
                                     {"id": 102, "nombre": "HD SSD 480GB KINGSTON A400 SA400S37/240G", "precio": 800}]}
        with redirect_stdout(io.StringIO()):
            indexar.main(["--historial", str(self.hist)])
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        self.assertEqual({f[3] + str(f[1]): f[9] for f in indice["productos"]},
                         {"uno1000": "SA400S37/480G", "dos900": "SA400S37/480G", "dos800": "SA400S37/240G"})

    def test_filas_viejas_se_completan_con_el_tipo_de_cada_campo(self):
        # Un indice anterior a las fotos tiene filas de 7 campos: cada faltante
        # tiene que quedar con su valor por defecto, no corrido de lugar.
        viejo = {"productos": [["Producto 1", 1000, url(1), "uno", "", 0, 900],
                               ["Producto 2", 2000, url(2), "uno", "", 0]]}
        (self.dir / "indice.json").write_text(json.dumps(viejo), encoding="utf-8")
        indice, _ = self.correr(None, [(101, 500)])              # uno se cae y se reusa lo viejo
        self.assertEqual(self.fila(indice, "uno", 1)[4:], ["", 0, 900, "", "", ""])
        self.assertEqual(self.fila(indice, "uno", 2)[4:], ["", 0, 0, "", "", ""])

    def previo(self, tiendas, generado="2026-10-07T15:25-03:00"):
        """Un indice anterior con un producto de uno, como lo dejo otra corrida."""
        viejo = {"generado": generado, "tiendas": tiendas,
                 "productos": [["Producto 1", 1000, url(1), "uno", "", 0, 0, "", ""]]}
        (self.dir / "indice.json").write_text(json.dumps(viejo), encoding="utf-8")

    def test_cada_fuente_lleva_la_hora_de_su_ultimo_relevamiento(self):
        indice, _ = self.correr([(1, 1000)], [(101, 500)])
        self.assertEqual(indice["tiendas"]["uno"]["relevado"], indice["generado"])
        self.assertEqual(indice["tiendas"]["dos"]["relevado"], indice["generado"])

    def test_fuente_que_falla_conserva_la_hora_de_su_ultimo_relevamiento(self):
        # Lo reusado no puede salir con la hora de hoy: es un precio viejo.
        self.previo({"uno": {"nombre": "Uno", "color": "cg", "relevado": "2026-10-06T09:10-03:00"}})
        indice, _ = self.correr(None, [(101, 500)])
        self.assertEqual(indice["tiendas"]["uno"]["relevado"], "2026-10-06T09:10-03:00")
        self.assertEqual(indice["tiendas"]["dos"]["relevado"], indice["generado"])

    def test_fuente_que_trae_cero_conserva_la_hora_de_su_ultimo_relevamiento(self):
        self.previo({"uno": {"nombre": "Uno", "color": "cg", "relevado": "2026-10-06T09:10-03:00"}})
        indice, _ = self.correr([], [(101, 500)])
        self.assertEqual(indice["tiendas"]["uno"]["relevado"], "2026-10-06T09:10-03:00")

    def test_indice_anterior_sin_relevado_usa_su_fecha_de_generado(self):
        self.previo({"uno": {"nombre": "Uno", "color": "cg"}})
        indice, _ = self.correr(None, [(101, 500)])
        self.assertEqual(indice["tiendas"]["uno"]["relevado"], "2026-10-07T15:25-03:00")

    def test_fuente_inactiva_conserva_la_hora_de_su_ultimo_relevamiento(self):
        cfg = json.loads((self.dir / "tiendas.json").read_text(encoding="utf-8"))
        cfg["uno"]["activa"] = False
        (self.dir / "tiendas.json").write_text(json.dumps(cfg), encoding="utf-8")
        self.previo({"uno": {"nombre": "Uno", "color": "cg", "relevado": "2026-10-06T09:10-03:00"}})
        indice, _ = self.correr([(1, 900)], [(101, 500)])
        self.assertEqual(self.fila(indice, "uno", 1)[1], 1000)
        self.assertEqual(indice["tiendas"]["uno"]["relevado"], "2026-10-06T09:10-03:00")

    def test_fuente_que_falla_sin_indice_anterior_no_lleva_relevado(self):
        indice, _ = self.correr(None, [(101, 500)])
        self.assertNotIn("relevado", indice["tiendas"]["uno"])
        self.assertEqual(indice["tiendas"]["dos"]["relevado"], indice["generado"])

    def test_la_misma_url_en_dos_fuentes_tiene_su_propio_antes(self):
        self.correr([(1, 1000)], [(1, 1200)])
        indice, _ = self.correr([(1, 900)], [(1, 1200)])
        self.assertEqual(self.fila(indice, "uno", 1)[6], 1000)
        self.assertEqual(self.fila(indice, "dos", 1)[6], 0)
