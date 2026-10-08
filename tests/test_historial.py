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
