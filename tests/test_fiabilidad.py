import io
import json
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

import fiabilidad as f


def rev(comercio, juicio, motivo="estatica"):
    return {"comercio": comercio, "juicio": juicio, "motivo": motivo}


class Clasificar(unittest.TestCase):
    def test_una_caida_con_prueba_es_caida(self):
        for motivo in ("estatica", "renderizada", "api de la tienda: sin stock", "api: nadie lo vende",
                       "api: el precio publicado ya no existe (el mas barato pide $3.000)",
                       "api de la tienda: el precio publicado ya no existe (pide $9)",
                       "agregador: el precio no aparece en la tienda (muestra $1.000)"):
            self.assertEqual(f.clasificar("caida", motivo), "caida", motivo)

    def test_lo_que_no_se_pudo_comprobar_no_cuenta_como_caida_de_la_tienda(self):
        # Se descartan igual (no se publica lo que no se pudo comprobar), pero no prueban nada contra la tienda.
        for motivo in ("api: no se puede verificar", "api: no se pudo verificar (403)",
                       "agregador: no se pudo abrir la tienda"):
            self.assertEqual(f.clasificar("caida", motivo), "sin_comprobar", motivo)

    def test_viva_y_dudosa(self):
        self.assertEqual(f.clasificar("viva", "api"), "en_pie")
        self.assertEqual(f.clasificar("dudosa", "estatica"), "sin_comprobar")


class Contar(unittest.TestCase):
    def test_cuenta_por_comercio(self):
        tele = {"u1": rev("a.test", "viva"), "u2": rev("a.test", "caida"), "u3": rev("a.test", "dudosa"),
                "u4": rev("b.test", "viva"), "u5": rev("a.test", "caida", "api: no se puede verificar")}
        c = f.contar(tele)
        self.assertEqual(c["a.test"], {"en_pie": 1, "caidas": 1, "sin_comprobar": 2})
        self.assertEqual(c["b.test"], {"en_pie": 1, "caidas": 0, "sin_comprobar": 0})

    def test_ignora_entradas_rotas(self):
        self.assertEqual(f.contar({"u": "basura", "v": {"comercio": "x.test"}, "w": None}), {})
        self.assertEqual(f.contar(None), {})

    def test_filas_llevan_la_fecha_y_salen_ordenadas(self):
        filas = f.filas({"u": rev("b.test", "viva"), "v": rev("a.test", "caida")}, "2026-10-21")
        self.assertEqual([x["comercio"] for x in filas], ["a.test", "b.test"])
        self.assertEqual(filas[0], {"fecha": "2026-10-21", "comercio": "a.test", "en_pie": 0, "caidas": 1,
                                    "sin_comprobar": 0})


class Archivo(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.carpeta = Path(self.dir) / "historial"

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def test_escribe_un_csv_por_mes_en_la_subcarpeta_y_agrega_sin_repetir_el_encabezado(self):
        f.escribir(self.carpeta, [{"fecha": "2026-10-21", "comercio": "a.test", "en_pie": 3, "caidas": 1, "sin_comprobar": 0}])
        f.escribir(self.carpeta, [{"fecha": "2026-10-22", "comercio": "a.test", "en_pie": 2, "caidas": 0, "sin_comprobar": 1}])
        f.escribir(self.carpeta, [{"fecha": "2026-11-01", "comercio": "b.test", "en_pie": 1, "caidas": 0, "sin_comprobar": 0}])
        self.assertEqual(sorted(p.name for p in (self.carpeta / "verificacion").iterdir()), ["2026-10.csv", "2026-11.csv"])
        texto = (self.carpeta / "verificacion" / "2026-10.csv").read_text(encoding="utf-8")
        self.assertEqual(texto.count("fecha,comercio"), 1)
        self.assertEqual(len(f.leer(self.carpeta)), 3)

    def test_no_pisa_el_historial_de_precios_ni_lo_confunde(self):
        # historial.py lee los CSV de la raiz: los de verificacion viven aparte y no se mezclan.
        import historial
        f.escribir(self.carpeta, [{"fecha": "2026-10-21", "comercio": "a.test", "en_pie": 1, "caidas": 0, "sin_comprobar": 0}])
        self.assertEqual(historial.archivos(self.carpeta), [])

    def test_sin_filas_no_crea_nada(self):
        self.assertIsNone(f.escribir(self.carpeta, []))
        self.assertFalse(self.carpeta.exists())

    def test_leer_sin_carpeta_o_con_filas_rotas(self):
        self.assertEqual(f.leer(self.carpeta), [])
        f.escribir(self.carpeta, [{"fecha": "2026-10-21", "comercio": "a.test", "en_pie": 1, "caidas": 0, "sin_comprobar": 0}])
        ruta = self.carpeta / "verificacion" / "2026-10.csv"
        ruta.write_text(ruta.read_text(encoding="utf-8") + "2026-10-22,b.test,x,y,z\n,,,,\n", encoding="utf-8")
        self.assertEqual([x["comercio"] for x in f.leer(self.carpeta)], ["a.test"])


FILAS = [
    {"fecha": "2026-09-01", "comercio": "a.test", "en_pie": 50, "caidas": 50, "sin_comprobar": 0},   # fuera de la ventana
    {"fecha": "2026-10-10", "comercio": "a.test", "en_pie": 20, "caidas": 2, "sin_comprobar": 1},
    {"fecha": "2026-10-20", "comercio": "a.test", "en_pie": 10, "caidas": 3, "sin_comprobar": 4},
    {"fecha": "2026-10-20", "comercio": "chica.test", "en_pie": 3, "caidas": 2, "sin_comprobar": 0},
    {"fecha": "2026-08-01", "comercio": "vieja.test", "en_pie": 9, "caidas": 1, "sin_comprobar": 0},
]


class Resumen(unittest.TestCase):
    def setUp(self):
        self.r = f.resumen(FILAS, "2026-10-21", dias=30, minimo=30)

    def test_dice_la_ventana_y_el_minimo(self):
        self.assertEqual((self.r["dias"], self.r["minimo"], self.r["hasta"]), (30, 30, "2026-10-21"))

    def test_suma_solo_la_ventana(self):
        a = self.r["comercios"]["a.test"]
        self.assertEqual((a["verificadas"], a["caidas"], a["sin_comprobar"]), (35, 5, 5))
        self.assertTrue(a["suficiente"])
        self.assertEqual(a["ultima"], "2026-10-20")

    def test_con_pocas_muestras_no_hay_veredicto(self):
        c = self.r["comercios"]["chica.test"]
        self.assertEqual((c["verificadas"], c["caidas"]), (5, 2))
        self.assertFalse(c["suficiente"])

    def test_un_comercio_sin_revisiones_en_la_ventana_figura_con_su_ultima_vez(self):
        v = self.r["comercios"]["vieja.test"]
        self.assertEqual((v["verificadas"], v["caidas"], v["suficiente"], v["ultima"]), (0, 0, False, "2026-08-01"))

    def test_el_dia_de_corte_es_inclusivo_hacia_atras_y_no_cuenta_el_futuro(self):
        r = f.resumen(FILAS, "2026-10-10", dias=30, minimo=30)
        self.assertEqual(r["comercios"]["a.test"]["verificadas"], 22)      # el 2026-10-20 es futuro; el 09-01 queda fuera
        r = f.resumen(FILAS, "2026-10-21", dias=1, minimo=1)
        self.assertNotIn("a.test", [k for k, c in r["comercios"].items() if c["verificadas"]])

    def test_sin_filas(self):
        self.assertEqual(f.resumen([], "2026-10-21")["comercios"], {})


class Principal(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.tele = self.dir / "tele.json"
        self.tele.write_text(json.dumps({"u1": rev("a.test", "viva"), "u2": rev("a.test", "caida")}), encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.dir, ignore_errors=True)

    def correr(self, *args):
        with redirect_stdout(io.StringIO()) as s:
            codigo = f.main(list(args))
        return codigo, s.getvalue()

    def test_agrega_a_la_historia_y_escribe_el_resumen(self):
        salida = self.dir / "fiabilidad.json"
        codigo, texto = self.correr("--telemetria", str(self.tele), "--historial", str(self.dir / "h"),
                                    "--salida", str(salida), "--fecha", "2026-10-21")
        self.assertEqual(codigo, 0)
        datos = json.loads(salida.read_text(encoding="utf-8"))
        self.assertEqual(datos["comercios"]["a.test"]["verificadas"], 2)
        self.assertEqual(datos["comercios"]["a.test"]["caidas"], 1)
        self.assertEqual(len(f.leer(self.dir / "h")), 1)
        self.assertIn("a.test", texto)

    def test_sin_telemetria_solo_resume_lo_que_ya_hay(self):
        f.escribir(self.dir / "h", [{"fecha": "2026-10-20", "comercio": "b.test", "en_pie": 4, "caidas": 0, "sin_comprobar": 0}])
        salida = self.dir / "fiabilidad.json"
        self.correr("--historial", str(self.dir / "h"), "--salida", str(salida), "--fecha", "2026-10-21")
        self.assertEqual(json.loads(salida.read_text(encoding="utf-8"))["comercios"]["b.test"]["verificadas"], 4)
        self.assertEqual(len(f.leer(self.dir / "h")), 1)

    def test_una_telemetria_rota_o_ausente_no_falla(self):
        self.tele.write_text("{no es json", encoding="utf-8")
        codigo, _ = self.correr("--telemetria", str(self.tele), "--historial", str(self.dir / "h"),
                                "--salida", str(self.dir / "o.json"), "--fecha", "2026-10-21")
        self.assertEqual(codigo, 0)
        codigo, _ = self.correr("--telemetria", str(self.dir / "no-hay.json"), "--historial", str(self.dir / "h"),
                                "--salida", str(self.dir / "o.json"), "--fecha", "2026-10-21")
        self.assertEqual(codigo, 0)

    def test_sin_fecha_usa_hoy_en_argentina(self):
        self.assertRegex(f.hoy(), r"^\d{4}-\d{2}-\d{2}$")


if __name__ == "__main__":
    unittest.main()
