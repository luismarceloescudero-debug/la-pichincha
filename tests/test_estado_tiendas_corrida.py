"""Spec 066 de punta a punta: indexar.main() da de baja, pone en pausa y vuelve a dar de alta solo."""
import io
import json
import shutil
import socket
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from datetime import date, datetime, timedelta
from pathlib import Path
from unittest import mock

import estado_tiendas as et
import indexar


def setUpModule():
    parche = mock.patch.object(indexar, "ESPERA_REINTENTO", 0)
    parche.start()
    unittest.addModuleCleanup(parche.stop)


def fuente(clave):
    return {"nombre": clave.capitalize(), "color": "cg", "activa": True, "base": f"https://{clave}.test",
            "catalogo": {"tipo": "json", "url": f"https://{clave}.test/cat", "ruta": "p/{slug}_{id}",
                         "campos": {"id": "id", "nombre": "nombre", "precio": "precio", "lista": "lista"}}}


class Base(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.hist = self.dir / "historial"
        (self.dir / "tiendas.json").write_text(json.dumps({"uno": fuente("uno"), "dos": fuente("dos")}),
                                               encoding="utf-8")
        for nombre, archivo in (("TIENDAS", "tiendas.json"), ("INDICE", "indice.json"), ("SALUD", "salud.json")):
            p = mock.patch.object(indexar, nombre, self.dir / archivo)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.object(indexar, "bajar", self.bajar)
        p.start()
        self.addCleanup(p.stop)
        self.modo = {"uno": "ok", "dos": "ok"}     # ok, vacia, bloqueo, muerta
        self.pedidos = []
        self.hoy = datetime.now(indexar.AR).date()

    def bajar(self, u):
        self.pedidos.append(u)
        clave = u.split("//")[1].split(".")[0]
        modo = self.modo[clave]
        if modo == "muerta":
            raise urllib.error.URLError(socket.gaierror(socket.EAI_NONAME, "Name or service not known"))
        if modo == "dns_temporal":
            raise urllib.error.URLError(socket.gaierror(socket.EAI_AGAIN, "Temporary failure in name resolution"))
        if modo == "catalogo_muerto" and u.endswith("/cat"):     # el catalogo dice NXDOMAIN pero la portada contesta
            raise urllib.error.URLError(socket.gaierror(socket.EAI_NONAME, "Name or service not known"))
        if modo == "bloqueo":
            raise urllib.error.HTTPError(u, 403, "Forbidden", {}, None)
        if u.endswith("/cat"):
            base = 1 + 100 * sorted(self.modo).index(clave)
            return json.dumps([] if modo == "vacia" else
                              [{"id": base + i, "nombre": f"Producto {base + i}", "precio": 1000} for i in range(2)])
        return "<html>portada</html>"

    def correr(self):
        self.pedidos = []
        with redirect_stdout(io.StringIO()):
            self.assertEqual(indexar.main(["--historial", str(self.hist)]), 0)
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        salud = json.loads((self.dir / "salud.json").read_text(encoding="utf-8"))
        return indice, salud

    def estados(self):
        return json.loads((self.hist / et.ARCHIVO).read_text(encoding="utf-8"))["tiendas"]

    def pasar_dias(self, n=1):
        """Las fechas del estado guardado retroceden n dias: la proxima corrida es n dias despues."""
        datos = json.loads((self.hist / et.ARCHIVO).read_text(encoding="utf-8"))
        for reg in datos["tiendas"].values():
            for campo, valor in reg.items():
                if isinstance(valor, str) and len(valor) == 10 and valor[4] == "-":
                    reg[campo] = (date.fromisoformat(valor) - timedelta(days=n)).isoformat()
        (self.hist / et.ARCHIVO).write_text(json.dumps(datos), encoding="utf-8")

    def tiendas_de(self, indice):
        return {f[3] for f in indice["productos"]}


class Corrida(Base):
    def test_el_estado_se_guarda_en_la_carpeta_del_historial(self):
        self.correr()
        self.assertEqual({k: r["estado"] for k, r in self.estados().items()}, {"uno": et.ACTIVA, "dos": et.ACTIVA})
        self.assertEqual(self.estados()["uno"]["ultima"], et.OK)

    def test_dominio_muerto_tres_corridas_da_de_baja_y_sale_del_indice(self):
        self.correr()
        self.modo["uno"] = "muerta"
        for _ in range(2):
            self.pasar_dias()
            indice, salud = self.correr()
            self.assertIn("uno", self.tiendas_de(indice), "antes de la baja se usa lo anterior con su fecha (E1)")
            self.assertEqual(salud["cambios"], [])
        self.pasar_dias()
        indice, salud = self.correr()
        self.assertNotIn("uno", self.tiendas_de(indice))
        self.assertNotIn("uno", indice["tiendas"], "una tienda dada de baja no se lista en el sitio")
        self.assertEqual([(c["clave"], c["de"], c["a"]) for c in salud["cambios"]], [("uno", et.ACTIVA, et.BAJA)])
        self.assertEqual(salud["tiendas"]["uno"]["estado"], et.BAJA)
        self.assertEqual(self.estados()["uno"]["muertas_seguidas"], 3)

    def dar_de_baja(self):
        self.correr()
        self.modo["uno"] = "muerta"
        for _ in range(3):
            self.pasar_dias()
            self.correr()
        self.assertEqual(self.estados()["uno"]["estado"], et.BAJA)

    def test_en_baja_no_se_releva_y_se_sondea_una_vez_por_semana(self):
        self.dar_de_baja()
        self.pasar_dias(3)
        indice, salud = self.correr()
        self.assertFalse([u for u in self.pedidos if "uno.test" in u], "dentro de la semana ni se la toca")
        self.assertNotIn("uno", indice["tiendas"])
        self.assertNotIn("uno", salud["fuentes"], "no se midio: no hay alerta diaria")
        self.pasar_dias(4)
        indice, salud = self.correr()
        self.assertEqual([u for u in self.pedidos if "uno.test" in u], ["https://uno.test"], "solo el ping a la portada")
        self.assertEqual((salud["cambios"], self.estados()["uno"]["estado"]), ([], et.BAJA))

    def test_si_revive_vuelve_sola_en_la_misma_corrida(self):
        self.dar_de_baja()
        self.modo["uno"] = "ok"
        self.pasar_dias(et.DIAS_PING_BAJA)
        indice, salud = self.correr()
        self.assertIn("uno", self.tiendas_de(indice))
        self.assertIn("uno", indice["tiendas"])
        self.assertEqual([(c["clave"], c["de"], c["a"]) for c in salud["cambios"]], [("uno", et.BAJA, et.ACTIVA)])
        self.assertEqual(self.estados()["uno"]["estado"], et.ACTIVA)

    def test_catorce_dias_sin_productos_pone_en_pausa_y_no_publica_precios_viejos(self):
        self.correr()
        self.modo["uno"] = "bloqueo"
        for _ in range(et.DIAS_PAUSA):
            self.pasar_dias()
            indice, salud = self.correr()
            self.assertIn("uno", self.tiendas_de(indice))
        self.assertEqual(self.estados()["uno"]["ultima"], et.BLOQUEO)
        self.pasar_dias()
        indice, salud = self.correr()
        self.assertNotIn("uno", self.tiendas_de(indice), "en pausa sus precios viejos no se muestran")
        self.assertEqual(indice["tiendas"]["uno"]["estado"], et.PAUSA)
        self.assertEqual([(c["clave"], c["a"]) for c in salud["cambios"]], [("uno", et.PAUSA)])
        self.pasar_dias()
        indice, salud = self.correr()
        self.assertTrue([u for u in self.pedidos if u == "https://uno.test/cat"], "en pausa se sigue intentando a diario")
        self.assertEqual(salud["cambios"], [], "un solo registro: nada de un cambio por dia")
        self.modo["uno"] = "ok"
        self.pasar_dias()
        indice, salud = self.correr()
        self.assertIn("uno", self.tiendas_de(indice))
        self.assertNotIn("estado", indice["tiendas"]["uno"])
        self.assertEqual([(c["clave"], c["de"], c["a"]) for c in salud["cambios"]], [("uno", et.PAUSA, et.ACTIVA)])

    def test_la_primera_vez_se_siembra_desde_el_relevado_del_indice_anterior(self):
        self.correr()
        (self.hist / et.ARCHIVO).unlink()
        for ruta in self.hist.glob("*.csv"):        # el historial de hoy diria que trajo productos hoy
            ruta.unlink()
        indice =json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        indice["tiendas"]["uno"]["relevado"] = (self.hoy - timedelta(days=20)).isoformat() + "T10:00-03:00"
        (self.dir / "indice.json").write_text(json.dumps(indice), encoding="utf-8")
        self.modo["uno"] = "vacia"
        indice, salud = self.correr()
        self.assertEqual(self.estados()["uno"]["estado"], et.PAUSA)
        self.assertNotIn("uno", self.tiendas_de(indice))
        self.assertEqual(self.estados()["dos"]["estado"], et.ACTIVA)

    def test_una_vacia_sondea_la_portada_para_saber_si_esta_muerta(self):
        self.correr()
        self.modo["uno"] = "vacia"
        self.pasar_dias()
        self.correr()
        self.assertIn("https://uno.test", self.pedidos)
        self.assertEqual(self.estados()["uno"]["ultima"], et.VACIA)

    def test_la_muerte_se_confirma_siempre_con_el_ping(self):
        self.correr()
        self.modo["uno"] = "catalogo_muerto"
        for _ in range(4):
            self.pasar_dias()
            self.correr()
        self.assertIn("https://uno.test", self.pedidos, "una fuente json tambien se sondea")
        self.assertEqual((self.estados()["uno"]["ultima"], self.estados()["uno"]["muertas_seguidas"]), (et.VACIA, 0))
        self.assertEqual(self.estados()["uno"]["estado"], et.ACTIVA)

    def test_dns_temporal_del_runner_es_vacia_y_no_da_de_baja(self):
        self.correr()
        self.modo["uno"] = "dns_temporal"
        for _ in range(4):
            self.pasar_dias()
            indice, _ = self.correr()
        self.assertEqual((self.estados()["uno"]["ultima"], self.estados()["uno"]["estado"]), (et.VACIA, et.ACTIVA))
        self.assertIn("uno", self.tiendas_de(indice), "sigue listada con lo anterior y se reintenta a diario")

    def test_solo_sin_tocar_las_demas(self):
        self.correr()
        antes = self.estados()["dos"]
        self.pasar_dias()
        with redirect_stdout(io.StringIO()):
            indexar.main(["--historial", str(self.hist), "--solo", "uno"])
        self.assertEqual(self.estados()["dos"]["ultima_corrida"], (self.hoy - timedelta(days=1)).isoformat())
        self.assertEqual(self.estados()["dos"]["estado"], antes["estado"])


class FrenoGlobal(Base):
    """Si >= 30 % de las tiendas relevadas cae por red o muerte, la corrida no suma contadores (el runner, no ellas)."""

    def setUp(self):
        super().setUp()
        claves = ["uno", "dos", "tres", "cuatro", "cinco", "seis"]
        (self.dir / "tiendas.json").write_text(json.dumps({k: fuente(k) for k in claves}), encoding="utf-8")
        self.modo = dict.fromkeys(claves, "ok")

    def test_caida_del_runner_no_da_de_baja_a_nadie(self):
        self.correr()
        antes = self.estados()
        for k in self.modo:
            self.modo[k] = "muerta"
        for _ in range(et.CORRIDAS_BAJA + 1):
            self.pasar_dias()
            indice, salud = self.correr()
            self.assertTrue(salud["freno"]["activo"])
            self.assertEqual(salud["cambios"], [])
            self.assertEqual(self.tiendas_de(indice), set(self.modo), "todas siguen con lo anterior")
        for k, r in self.estados().items():
            self.assertEqual((r["estado"], r["muertas_seguidas"], r["sin_productos_desde"]),
                             (et.ACTIVA, 0, antes[k]["sin_productos_desde"]), k)

    def test_dos_de_seis_es_freno_y_una_de_seis_no(self):
        self.correr()
        self.modo["uno"] = "muerta"
        self.pasar_dias()
        _, salud = self.correr()
        self.assertFalse(salud["freno"]["activo"])
        self.assertEqual(self.estados()["uno"]["muertas_seguidas"], 1)
        self.modo["dos"] = "dns_temporal"
        self.pasar_dias()
        _, salud = self.correr()
        self.assertTrue(salud["freno"]["activo"], "2 de 6 (33 %) caidas por la red o muertas")
        self.assertEqual((salud["freno"]["relevadas"], salud["freno"]["caidas"]), (6, 2))
        self.assertEqual(self.estados()["uno"]["muertas_seguidas"], 1, "la corrida frenada no suma")
        self.assertEqual(self.estados()["tres"]["ultima"], et.OK, "lo que anduvo si se anota")


if __name__ == "__main__":
    unittest.main()
