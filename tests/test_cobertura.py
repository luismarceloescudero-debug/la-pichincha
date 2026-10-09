import json
import shutil
import tempfile
import unittest
from pathlib import Path

import cobertura

KF = "Memoria Ddr4 16Gb Kingston Fury Beast KF432C16BB1/16"
SED = "Disco Ssd 480Gb Kingston Sedc600M/480G"


def fila(nombre, tienda, modelo=None):
    f = [nombre, 1000, f"https://{tienda}.test/{abs(hash(nombre))}", tienda, "", 0, 0, "", ""]
    return f + [modelo] if modelo is not None else f


class Informe(unittest.TestCase):
    def test_cuenta_avisos_con_codigo_y_agrupados_por_rubro(self):
        filas = [
            fila(KF, "uno", "KF432C16BB1/16"), fila(KF, "dos", "KF432C16BB1/16"),
            fila("Memoria Ddr4 8Gb Adata Premier", "uno", ""),
            fila(SED, "uno", "SEDC600M/480G"),
            fila("Notebook HP 15 SSD 512GB", "uno", ""),
        ]
        r = cobertura.informe(filas)["rubros"]
        self.assertEqual(r["ram"], {"avisos": 3, "con_codigo": 2, "agrupados": 2, "grupos": 1})
        self.assertEqual(r["ssd"], {"avisos": 1, "con_codigo": 1, "agrupados": 0, "grupos": 0})
        self.assertEqual(r["gpu"], {"avisos": 0, "con_codigo": 0, "agrupados": 0, "grupos": 0})

    def test_un_grupo_necesita_tiendas_distintas(self):
        filas = [fila(KF, "uno", "KF432C16BB1/16"), fila(KF + " v2", "uno", "KF432C16BB1/16")]
        r = cobertura.informe(filas)["rubros"]["ram"]
        self.assertEqual((r["con_codigo"], r["agrupados"], r["grupos"]), (2, 0, 0))

    def test_filas_de_un_indice_viejo_sin_la_columna_se_calculan_del_nombre(self):
        filas = [fila(KF, "uno"), fila(KF, "dos")]
        r = cobertura.informe(filas)["rubros"]["ram"]
        self.assertEqual((r["con_codigo"], r["agrupados"], r["grupos"]), (2, 2, 1))


class Comparacion(unittest.TestCase):
    def rubros(self, avisos, con):
        return {"rubros": {"ram": {"avisos": avisos, "con_codigo": con, "agrupados": 0, "grupos": 0}}}

    def test_una_caida_de_mas_de_10_puntos_se_marca(self):
        alertas = cobertura.caidas(self.rubros(100, 40), self.rubros(100, 60))
        self.assertEqual([a[0] for a in alertas], ["ram"])

    def test_una_caida_chica_o_una_suba_no(self):
        self.assertEqual(cobertura.caidas(self.rubros(100, 55), self.rubros(100, 60)), [])
        self.assertEqual(cobertura.caidas(self.rubros(100, 70), self.rubros(100, 60)), [])

    def test_sin_anterior_no_hay_comparacion(self):
        self.assertEqual(cobertura.caidas(self.rubros(100, 40), None), [])


class Comando(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        (self.dir / "indice.json").write_text(json.dumps({"generado": "2026-10-09T08:12-03:00", "productos": [
            fila(KF, "uno", "KF432C16BB1/16"), fila(KF, "dos", "KF432C16BB1/16")]}), encoding="utf-8")

    def test_escribe_el_informe_y_el_resumen(self):
        salida, resumen = self.dir / "cobertura.json", self.dir / "resumen.md"
        self.assertEqual(cobertura.main([str(self.dir / "indice.json"), "--salida", str(salida),
                                         "--resumen", str(resumen)]), 0)
        datos = json.loads(salida.read_text(encoding="utf-8"))
        self.assertEqual(datos["generado"], "2026-10-09T08:12-03:00")
        self.assertEqual(datos["rubros"]["ram"]["grupos"], 1)
        self.assertIn("ram", resumen.read_text(encoding="utf-8"))

    def test_una_previa_ilegible_no_rompe_la_corrida(self):
        previa = self.dir / "previa.json"
        previa.write_text("no es json", encoding="utf-8")
        self.assertEqual(cobertura.main([str(self.dir / "indice.json"), "--salida", str(self.dir / "c.json"),
                                         "--previa", str(previa)]), 0)

    def test_una_caida_sale_en_el_resumen(self):
        previa = self.dir / "previa.json"
        previa.write_text(json.dumps({"rubros": {"ram": {"avisos": 2, "con_codigo": 2, "agrupados": 2, "grupos": 1}}}),
                          encoding="utf-8")
        (self.dir / "indice.json").write_text(json.dumps({"generado": "x", "productos": [
            fila("Memoria Ddr4 8Gb Adata", "uno", ""), fila(KF, "dos", "KF432C16BB1/16")]}), encoding="utf-8")
        resumen = self.dir / "resumen.md"
        cobertura.main([str(self.dir / "indice.json"), "--salida", str(self.dir / "c.json"),
                        "--previa", str(previa), "--resumen", str(resumen)])
        self.assertIn("revisar nombres de tiendas", resumen.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
