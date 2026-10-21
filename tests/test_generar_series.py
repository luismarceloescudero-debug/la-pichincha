import csv
import json
import shutil
import tempfile
import unittest
from datetime import date
from pathlib import Path

import generar_series as gs


def escribir_csv(carpeta, filas):
    carpeta = Path(carpeta)
    por_mes = {}
    for f in filas:
        por_mes.setdefault(f[0][:7], []).append(f)
    for mes, lista in por_mes.items():
        with (carpeta / f"{mes}.csv").open("w", encoding="utf-8", newline="") as h:
            w = csv.writer(h, lineterminator="\n")
            w.writerow(["fecha", "tienda", "id", "precio"])
            w.writerows(lista)


def fila(nombre, precio, url, tienda="cg"):
    return [nombre, precio, url, tienda, "", 0, 0, "", "", "", "", 0, 0]


class Clave(unittest.TestCase):
    # Los mismos vectores estan en tests/js/serie-precios.test.js: si una de las dos implementaciones cambia, falla una.
    VECTORES = {
        ("cg", "https://compragamer.com/producto/x_1"): "1587a1b1a60607",
        ("comparaya", "https://articulo.mercadolibre.com.ar/MLA-1-ñandú_JM"): "29181109cccdb",
    }

    def test_vectores_fijos(self):
        for (tienda, url), esperado in self.VECTORES.items():
            with self.subTest(url=url):
                self.assertEqual(gs.clave(tienda, url), esperado)

    def test_la_clave_distingue_tienda_y_url(self):
        self.assertNotEqual(gs.clave("cg", "u"), gs.clave("gc", "u"))
        self.assertNotEqual(gs.clave("cg", "u1"), gs.clave("cg", "u2"))

    def test_el_fragmento_esta_en_rango_y_es_estable(self):
        for n in range(200):
            f = gs.fragmento("cg", f"u{n}")
            self.assertTrue(0 <= f < gs.FRAGMENTOS)
        self.assertEqual(gs.fragmento("cg", "u1"), gs.fragmento("cg", "u1"))


class Puntos(unittest.TestCase):
    H = date(2026, 10, 21)

    def test_sin_eventos_no_hay_serie(self):
        self.assertIsNone(gs.recorte([], self.H))

    def test_un_solo_dia_de_datos_no_alcanza(self):
        self.assertIsNone(gs.recorte([(self.H, 100)], self.H))

    def test_precio_estable_desde_hace_dias_son_dos_puntos(self):
        self.assertEqual(gs.recorte([(date(2026, 10, 7), 100)], self.H), [(date(2026, 10, 7), 100)])

    def test_un_producto_que_dejo_de_publicarse_y_volvio_empieza_de_nuevo(self):
        ev = [(date(2026, 10, 7), 100), (date(2026, 10, 10), None), (date(2026, 10, 15), 120)]
        self.assertEqual(gs.recorte(ev, self.H), [(date(2026, 10, 15), 120)])

    def test_si_hoy_no_se_publica_no_hay_serie(self):
        ev = [(date(2026, 10, 7), 100), (date(2026, 10, 20), None)]
        self.assertIsNone(gs.recorte(ev, self.H))

    def test_varias_corridas_el_mismo_dia_dejan_el_ultimo_precio(self):
        ev = [(date(2026, 10, 7), 100), (date(2026, 10, 12), 90), (date(2026, 10, 12), 95), (date(2026, 10, 12), 99)]
        self.assertEqual(gs.recorte(ev, self.H), [(date(2026, 10, 7), 100), (date(2026, 10, 12), 99)])

    def test_un_cambio_que_vuelve_al_mismo_precio_en_el_dia_no_es_un_cambio(self):
        ev = [(date(2026, 10, 7), 100), (date(2026, 10, 12), 90), (date(2026, 10, 12), 100)]
        self.assertEqual(gs.recorte(ev, self.H), [(date(2026, 10, 7), 100)])

    def test_compactar_usa_dias_desde_la_base(self):
        ev = [(date(2026, 10, 7), 100), (date(2026, 10, 9), 90)]
        self.assertEqual(gs.compactar(ev, date(2026, 10, 7)), [0, 100, 2, 90])


class Generar(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.hist = self.tmp / "historial"
        self.hist.mkdir()
        self.salida = self.tmp / "sitio"

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def indice(self, productos, generado="2026-10-21T11:07-03:00"):
        ruta = self.tmp / "indice.json"
        ruta.write_text(json.dumps({"generado": generado, "productos": productos}), encoding="utf-8")
        return ruta

    def leer_todo(self):
        series = {}
        for r in sorted((self.salida / "series").glob("*.json")):
            d = json.loads(r.read_text(encoding="utf-8"))
            series.update(d["s"])
        return series

    def test_escribe_la_serie_de_lo_que_esta_en_el_indice(self):
        escribir_csv(self.hist, [
            ["2026-10-07", "cg", "u1", "100"], ["2026-10-12", "cg", "u1", "90"],
            ["2026-10-07", "cg", "u2", "50"],
            ["2026-10-07", "cg", "fuera", "70"],          # no esta en el indice: no se publica
            ["2026-10-21", "cg", "nuevo", "10"],          # un solo dia: nada que mostrar
        ])
        ruta = self.indice([fila("A", 90, "u1"), fila("B", 50, "u2"), fila("C", 10, "nuevo")])
        r = gs.generar(ruta, self.hist, self.salida)
        todo = self.leer_todo()
        self.assertEqual(todo[gs.clave("cg", "u1")], [0, 100, 5, 90])
        self.assertEqual(todo[gs.clave("cg", "u2")], [0, 50])
        self.assertNotIn(gs.clave("cg", "fuera"), todo)
        self.assertNotIn(gs.clave("cg", "nuevo"), todo)
        self.assertEqual(r["avisos"], 2)

    def test_el_encabezado_dice_desde_cuando_y_hasta_cuando(self):
        escribir_csv(self.hist, [["2026-10-07", "cg", "u1", "100"], ["2026-10-12", "cg", "u1", "90"]])
        gs.generar(self.indice([fila("A", 90, "u1")]), self.hist, self.salida)
        d = json.loads(next((self.salida / "series").glob("*.json")).read_text(encoding="utf-8"))
        self.assertEqual((d["v"], d["base"], d["hasta"]), (1, "2026-10-07", "2026-10-21"))

    def test_un_aviso_cuyo_precio_de_hoy_no_es_el_del_historial_no_se_publica(self):
        # Si el indice dice otra cosa que el historial, el grafico no puede afirmar nada: se omite.
        escribir_csv(self.hist, [["2026-10-07", "cg", "u1", "100"], ["2026-10-12", "cg", "u1", "90"]])
        r = gs.generar(self.indice([fila("A", 95, "u1")]), self.hist, self.salida)
        self.assertEqual(self.leer_todo(), {})
        self.assertEqual(r["desparejos"], 1)

    def test_sin_carpeta_de_historial_no_escribe_nada_y_no_falla(self):
        r = gs.generar(self.indice([fila("A", 90, "u1")]), self.tmp / "no-existe", self.salida)
        self.assertEqual(r["avisos"], 0)
        self.assertFalse((self.salida / "series").exists())

    def test_dos_corridas_dan_los_mismos_archivos(self):
        escribir_csv(self.hist, [["2026-10-07", "cg", "u1", "100"], ["2026-10-12", "cg", "u1", "90"]])
        ruta = self.indice([fila("A", 90, "u1")])
        gs.generar(ruta, self.hist, self.salida)
        a = {p.name: p.read_bytes() for p in (self.salida / "series").glob("*.json")}
        gs.generar(ruta, self.hist, self.salida)
        b = {p.name: p.read_bytes() for p in (self.salida / "series").glob("*.json")}
        self.assertEqual(a, b)

    def test_una_corrida_nueva_borra_fragmentos_que_ya_no_hacen_falta(self):
        escribir_csv(self.hist, [["2026-10-07", "cg", "u1", "100"], ["2026-10-12", "cg", "u1", "90"]])
        (self.salida / "series").mkdir(parents=True)
        (self.salida / "series" / "99.json").write_text("{}", encoding="utf-8")
        gs.generar(self.indice([fila("A", 90, "u1")]), self.hist, self.salida)
        self.assertFalse((self.salida / "series" / "99.json").exists())


if __name__ == "__main__":
    unittest.main()
