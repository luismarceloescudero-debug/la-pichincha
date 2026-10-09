import csv
import shutil
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path

import serie

HOY = date(2026, 11, 20)


def d(atras):
    return HOY - timedelta(days=atras)


def historial(eventos):
    """eventos: [(dias_atras, precio o None)] de un solo producto -> la carpeta con sus CSV mensuales."""
    carpeta = Path(tempfile.mkdtemp())
    por_mes = {}
    for atras, precio in sorted(eventos, reverse=True):
        dia = d(atras)
        por_mes.setdefault(dia.strftime("%Y-%m"), []).append(
            {"fecha": dia.isoformat(), "tienda": "cg", "id": "u1", "precio": "" if precio is None else precio})
    for mes, filas in por_mes.items():
        with (carpeta / f"{mes}.csv").open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=["fecha", "tienda", "id", "precio"], lineterminator="\n")
            w.writeheader()
            w.writerows(filas)
    return carpeta


def serie_de(eventos):
    carpeta = historial(eventos)
    try:
        return serie.cargar(carpeta)[("cg", "u1")]
    finally:
        shutil.rmtree(carpeta)


class Lectura(unittest.TestCase):
    def test_lee_todos_los_meses_en_orden_con_las_bajas_como_none(self):
        ev = serie_de([(45, 100), (20, 90), (5, None)])
        self.assertEqual(ev, [(d(45), 100), (d(20), 90), (d(5), None)])

    def test_sin_carpeta_no_hay_series(self):
        self.assertEqual(serie.cargar(Path(tempfile.gettempdir()) / "no-existe-xyz"), {})

    def test_el_precio_de_un_dia_lleva_el_ultimo_cambio_hacia_adelante(self):
        ev = [(d(45), 100), (d(20), 90), (d(5), None)]
        self.assertIsNone(serie.precio_el(ev, d(50)))
        self.assertEqual(serie.precio_el(ev, d(45)), 100)
        self.assertEqual(serie.precio_el(ev, d(30)), 100)
        self.assertEqual(serie.precio_el(ev, d(20)), 90)
        self.assertEqual(serie.precio_el(ev, d(10)), 90)
        self.assertIsNone(serie.precio_el(ev, d(5)))       # dejo de publicarse

    def test_dias_de_historia(self):
        ev = [(d(45), 100), (d(20), 90)]
        self.assertEqual(serie.dias_de_historia(ev, HOY), 45)
        self.assertEqual(serie.dias_de_historia([], HOY), 0)


class MinimoDeLaSerie(unittest.TestCase):
    def test_en_su_minimo_de_30_dias_con_historia_suficiente(self):
        ev = [(d(40), 120), (d(20), 100)]
        self.assertEqual(serie.sellos_de(ev, HOY, 95), "m")
        self.assertEqual(serie.sellos_de(ev, HOY, 100), "m")       # igual al minimo tambien cuenta

    def test_si_fue_mas_barato_dentro_de_los_30_dias_no(self):
        ev = [(d(40), 120), (d(25), 90), (d(10), 100)]
        self.assertEqual(serie.sellos_de(ev, HOY, 100), "")

    def test_un_minimo_viejo_no_cuenta(self):
        ev = [(d(60), 80), (d(35), 120)]                  # el 80 fue hace mas de 30 dias
        self.assertEqual(serie.sellos_de(ev, HOY, 100), "m")

    def test_menos_de_30_dias_de_historia_no_afirma_nada(self):
        self.assertEqual(serie.sellos_de([(d(29), 120)], HOY, 50), "")
        self.assertEqual(serie.sellos_de([], HOY, 50), "")

    def test_un_solo_precio_en_40_dias_es_su_minimo(self):
        self.assertEqual(serie.sellos_de([(d(40), 100)], HOY, 100), "m")

    def test_minimo_de_90_dias_reemplaza_al_de_30(self):
        ev = [(d(100), 150), (d(50), 120)]
        self.assertEqual(serie.sellos_de(ev, HOY, 110), "h")

    def test_con_90_dias_de_historia_pero_mas_barato_hace_60_queda_el_de_30(self):
        ev = [(d(100), 150), (d(60), 90), (d(40), 120)]
        self.assertEqual(serie.sellos_de(ev, HOY, 110), "m")

    def test_un_producto_que_dejo_de_publicarse_y_volvio_empieza_de_nuevo(self):
        ev = [(d(100), 90), (d(70), None), (d(10), 100)]
        self.assertEqual(serie.sellos_de(ev, HOY, 100), "")        # su historia nueva tiene 10 dias


class RebajaInflada(unittest.TestCase):
    def test_subio_y_bajo_casi_al_nivel_de_antes(self):
        ev = [(d(25), 100), (d(15), 130), (d(3), 105)]
        self.assertEqual(serie.sellos_de(ev, HOY, 105), "x")

    def test_una_baja_de_verdad_no_se_marca(self):
        ev = [(d(25), 100), (d(15), 130), (d(3), 80)]
        self.assertEqual(serie.sellos_de(ev, HOY, 80), "")

    def test_el_precio_de_hoy_puede_ser_la_baja_que_todavia_no_esta_en_el_historial(self):
        ev = [(d(25), 100), (d(15), 130)]
        self.assertEqual(serie.sellos_de(ev, HOY, 105), "x")

    def test_menos_de_14_dias_de_historia_no_afirma_nada(self):
        ev = [(d(10), 100), (d(6), 130), (d(2), 105)]
        self.assertEqual(serie.sellos_de(ev, HOY, 105), "")

    def test_si_el_ultimo_cambio_no_es_una_baja_no(self):
        ev = [(d(25), 100), (d(15), 130)]
        self.assertEqual(serie.sellos_de(ev, HOY, 130), "")

    def test_una_baja_vieja_ya_no_se_marca(self):
        ev = [(d(80), 100), (d(70), 130), (d(60), 105)]
        self.assertEqual(serie.sellos_de(ev, HOY, 105), "m")       # sin "subio antes": la baja es de hace 60 dias

    def test_una_suba_chica_no_es_inflar(self):
        ev = [(d(40), 100), (d(15), 105), (d(3), 100)]
        self.assertEqual(serie.sellos_de(ev, HOY, 100), "m")       # no hay "subio antes", y si es minimo

    def test_puede_llevar_el_sello_de_minimo_y_el_de_inflada_a_la_vez(self):
        ev = [(d(40), 105), (d(25), 100), (d(15), 130), (d(3), 100)]
        self.assertEqual(serie.sellos_de(ev, HOY, 100), "mx")


if __name__ == "__main__":
    unittest.main()
