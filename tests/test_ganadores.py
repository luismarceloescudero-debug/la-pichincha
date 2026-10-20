import copy
import json
import unittest
from pathlib import Path

import generar_ganadores as gg

RAIZ = Path(__file__).resolve().parent.parent


def _doc():
    return json.loads((RAIZ / "datos" / "ganadores.json").read_text(encoding="utf-8"))


class DatosPublicados(unittest.TestCase):
    def test_el_archivo_del_repo_es_valido(self):
        self.assertEqual(gg.validar(_doc()), [])

    def test_todo_ganador_confirmado_tiene_fuente_https_y_fecha(self):
        for g in _doc()["ganadores"]:
            self.assertTrue(g["fuente"]["url"].startswith("https://"), g["modelo"])


class Validacion(unittest.TestCase):
    def _con(self, cambio):
        d = copy.deepcopy(_doc())
        cambio(d["ganadores"][0])
        return gg.validar(d)

    def test_campo_obligatorio_faltante(self):
        self.assertTrue(any("falta fuente" in e for e in self._con(lambda g: g.pop("fuente"))))

    def test_puntaje_fuera_de_rango_o_no_numerico(self):
        for malo in (101, -1, "90", True):
            self.assertTrue(any("puntaje" in e for e in self._con(lambda g: g.update(puntaje=malo))), malo)

    def test_fuente_sin_https(self):
        self.assertTrue(any("fuente" in e for e in self._con(lambda g: g["fuente"].update(url="http://x.com"))))

    def test_fecha_no_iso(self):
        self.assertTrue(any("fecha" in e for e in self._con(lambda g: g.update(fecha="20/10/2026"))))

    def test_confianza_y_categoria_invalidas(self):
        self.assertTrue(any("confianza" in e for e in self._con(lambda g: g.update(confianza="seguro"))))
        self.assertTrue(any("categoria" in e for e in self._con(lambda g: g.update(categoria="heladera"))))

    def test_criterios_sin_unidad_o_desconocidos(self):
        self.assertTrue(any("unidad" in e for e in self._con(lambda g: g.update(criterios={"rendimiento": {"valor": 1}}))))
        self.assertTrue(any("desconocido" in e for e in self._con(lambda g: g.update(criterios={"marca": {"valor": 1, "unidad": "x"}}))))
        self.assertTrue(any("vacios" in e for e in self._con(lambda g: g.update(criterios={}))))

    def test_escala_vacia(self):
        self.assertTrue(any("escala" in e for e in self._con(lambda g: g.update(escala=" "))))

    def test_duplicado_en_la_misma_categoria(self):
        d = _doc()
        d["ganadores"].append(copy.deepcopy(d["ganadores"][0]))
        self.assertTrue(any("duplicado" in e for e in gg.validar(d)))

    def test_documento_roto(self):
        self.assertEqual(gg.validar([]), ["el documento no es un objeto"])
        self.assertTrue(any("_nota" in e for e in gg.validar({"ganadores": []})))
        d = _doc()
        d["generado"] = "ayer"
        self.assertTrue(any("generado" in e for e in gg.validar(d)))
        d = _doc()
        d["ganadores"] = ["x"]
        self.assertTrue(any("no es un objeto" in e for e in gg.validar(d)))
        d["ganadores"] = []
        self.assertTrue(any("lista no vacia" in e for e in gg.validar(d)))


class Cobertura(unittest.TestCase):
    def test_cuenta_avisos_por_alias_o_por_modelo(self):
        d = _doc()
        d["ganadores"] = [d["ganadores"][3]]  # RTX 5090
        indice = {"campos": ["nombre", "modelo"], "productos": [
            ["Placa de video Asus RTX 5090 32GB", ""], ["Mouse", "X"], ["Otra", "rtx 5090"]]}
        self.assertEqual(gg.cobertura(d, indice)[0][2], 2)

    def test_main_valida_y_mide(self):
        import io, tempfile
        from contextlib import redirect_stdout
        with tempfile.TemporaryDirectory() as t:
            ruta = Path(t) / "indice.json"
            ruta.write_text(json.dumps({"campos": ["nombre", "modelo"], "productos": [["RTX 5080", ""]]}), encoding="utf-8")
            buf = io.StringIO()
            with redirect_stdout(buf):
                self.assertEqual(gg.main(["--cobertura", str(ruta)]), 0)
        self.assertIn("estan en el indice", buf.getvalue())
