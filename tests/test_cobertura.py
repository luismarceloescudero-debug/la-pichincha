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


class SerieDePrecios(unittest.TestCase):
    def test_cuenta_los_avisos_con_cada_sello_de_serie(self):
        filas = [fila("A", "uno", ""), fila("B", "uno", ""), fila("C", "dos", ""), fila("D", "dos", "")]
        filas[0][8], filas[1][8], filas[2][8], filas[3][8] = "m", "mx", "eh", "i"
        self.assertEqual(cobertura.sellos_de_serie(filas), {"minimo30": 2, "minimo90": 1, "subio_antes": 1})

    def test_los_dias_de_historia_salen_del_primer_cambio_registrado(self):
        carpeta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, carpeta)
        (carpeta / "2026-10.csv").write_text(chr(10).join(["fecha,tienda,id,precio", "2026-10-07,cg,u1,100",
                                                             "2026-10-08,cg,u2,200"]) + chr(10), encoding="utf-8")
        self.assertEqual(cobertura.dias_de_historia(carpeta, "2026-10-09T08:12-03:00"), 2)
        self.assertEqual(cobertura.dias_de_historia(carpeta / "no-hay", "2026-10-09T08:12-03:00"), 0)

    def test_el_informe_y_el_resumen_traen_la_serie(self):
        carpeta = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, carpeta)
        (carpeta / "2026-10.csv").write_text(chr(10).join(["fecha,tienda,id,precio", "2026-10-07,cg,u1,100"]) + chr(10),
                                             encoding="utf-8")
        f = fila(KF, "uno", "KF432C16BB1/16")
        f[8] = "m"
        indice = carpeta / "indice.json"
        indice.write_text(json.dumps({"generado": "2026-10-09T08:12-03:00", "productos": [f]}), encoding="utf-8")
        salida, resumen = carpeta / "c.json", carpeta / "r.md"
        cobertura.main([str(indice), "--salida", str(salida), "--historial", str(carpeta), "--resumen", str(resumen)])
        datos = json.loads(salida.read_text(encoding="utf-8"))
        self.assertEqual(datos["serie"], {"dias_de_historia": 2, "minimo30": 1, "minimo90": 0, "subio_antes": 0})
        self.assertIn("2 días de historia", resumen.read_text(encoding="utf-8"))


class EnLaAction(unittest.TestCase):
    def test_la_action_publica_la_cobertura_y_la_compara_con_la_anterior(self):
        yml = (Path(__file__).resolve().parent.parent / ".github" / "workflows" / "actualizar.yml").read_text(encoding="utf-8")
        self.assertIn("python cobertura.py indice.json --salida _sitio/cobertura.json", yml)
        self.assertIn("--previa https://luismarceloescudero-debug.github.io/la-pichincha/cobertura.json", yml)
        self.assertIn('--resumen "$GITHUB_STEP_SUMMARY"', yml)
        self.assertLess(yml.index("Generar las paginas por busqueda"), yml.index("cobertura.py"))


if __name__ == "__main__":
    unittest.main()
