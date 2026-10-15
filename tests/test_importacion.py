"""importacion.json (plan v3, K0): las reglas de importacion con su fuente, su fecha y su nivel de confianza.

Los tests no verifican la normativa (eso lo hace una persona leyendo ARCA y el Boletin Oficial): verifican que
cada regla diga de donde sale, desde cuando rige y cuando se miro por ultima vez, que lo "oficial" salga de un
dominio del Estado y que lo que no se pudo confirmar este marcado como pendiente en lugar de tener un numero
inventado."""

import json
import unittest
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urlparse

RUTA = Path(__file__).resolve().parent.parent / "importacion.json"
DATOS = json.loads(RUTA.read_text(encoding="utf-8")) if RUTA.exists() else {}

NIVELES = {"oficial", "prensa", "dudoso", "pendiente"}
DOMINIOS_OFICIALES = ("argentina.gob.ar", "boletinoficial.gob.ar", "arca.gob.ar", "afip.gob.ar",
                      "servicioscf.afip.gob.ar", "infoleg.gob.ar", "biblioteca.afip.gob.ar", "biblioteca.arca.gob.ar")
VENCE_A_LOS = 60   # dias: pasado ese plazo la pagina avisa que la regla no se verifico (K5)


def es_oficial(url):
    host = urlparse(url).hostname or ""
    return any(host == d or host.endswith("." + d) for d in DOMINIOS_OFICIALES)


class Esquema(unittest.TestCase):
    def test_el_archivo_existe_y_tiene_reglas(self):
        self.assertTrue(RUTA.exists(), "falta importacion.json")
        self.assertIn("reglas", DATOS)
        self.assertGreaterEqual(len(DATOS["reglas"]), 15)

    def test_dice_cuando_se_verifico_y_a_los_cuantos_dias_vence(self):
        verificado = date.fromisoformat(DATOS["verificado"])
        self.assertLessEqual(verificado, date.today())
        self.assertEqual(DATOS["vence_a_los_dias"], VENCE_A_LOS)

    def test_cada_regla_dice_de_donde_sale_y_cuando_se_miro(self):
        for clave, r in DATOS["reglas"].items():
            with self.subTest(regla=clave):
                self.assertIn(r["nivel"], NIVELES)
                self.assertTrue(r["descripcion"].strip())
                verificada = date.fromisoformat(r["verificado"])
                self.assertLessEqual(verificada, date.today())
                self.assertGreaterEqual(verificada, date.today() - timedelta(days=VENCE_A_LOS * 2),
                                        "una regla sin tocar hace meses: hay que volver a verificarla")
                if r.get("rige_desde"):
                    date.fromisoformat(r["rige_desde"])

    def test_lo_oficial_sale_de_un_dominio_del_estado_y_lo_demas_dice_por_que_no(self):
        for clave, r in DATOS["reglas"].items():
            with self.subTest(regla=clave):
                fuentes = r.get("fuentes", [])
                if r["nivel"] == "oficial":
                    self.assertTrue(fuentes, "una regla oficial necesita su fuente")
                    self.assertTrue(r.get("norma", "").strip(), "una regla oficial cita su norma")
                    for url in fuentes:
                        self.assertTrue(url.startswith("https://") and es_oficial(url), url)
                else:
                    self.assertTrue(r.get("nota", "").strip(), "lo que no es oficial explica por que")

    def test_lo_pendiente_no_tiene_numero_y_lo_que_tiene_numero_no_esta_pendiente(self):
        for clave, r in DATOS["reglas"].items():
            with self.subTest(regla=clave):
                if r["nivel"] == "pendiente":
                    self.assertIsNone(r["valor"], "no se inventan numeros: pendiente es sin valor")
                else:
                    self.assertIsNotNone(r["valor"])


class ReglasFirmes(unittest.TestCase):
    """Lo que se leyo en el texto oficial el 15/10/2026. Si cambia la norma, cambia el archivo y este test."""

    ESPERADO = {
        "franquicia_usd": 400,
        "envios_por_anio": 5,
        "tope_fob_usd": 3000,
        "unidades_max_misma_especie": 3,
        "peso_max_kg": 50,
        "tasa_estadistica_pct": 3,
        "iva_general_pct": 21,
        "percepcion_tarjeta_pct": 30,
        "derecho_importacion_celulares_pct": 0,
        "impuesto_interno_electronica_importada_pct": 9.5,
    }

    def test_los_valores_que_ya_se_leyeron_en_la_norma(self):
        for clave, valor in self.ESPERADO.items():
            with self.subTest(regla=clave):
                self.assertEqual(DATOS["reglas"][clave]["valor"], valor)
                self.assertEqual(DATOS["reglas"][clave]["nivel"], "oficial")

    def test_lo_que_no_se_pudo_confirmar_queda_como_pendiente(self):
        for clave in ("derecho_importacion_hardware_pct", "percepciones_courier", "honorarios_courier",
                      "base_impuesto_interno", "iva_reducido_hardware", "cronograma_rg_5884"):
            with self.subTest(regla=clave):
                self.assertEqual(DATOS["reglas"][clave]["nivel"], "pendiente")

    def test_la_franquicia_exime_derechos_y_tasa_pero_no_el_iva(self):
        self.assertEqual(sorted(DATOS["reglas"]["exento_en_franquicia"]["valor"]), ["derecho_importacion", "tasa_estadistica"])
        self.assertEqual(sorted(DATOS["reglas"]["tributos_en_franquicia"]["valor"]), ["impuestos_internos", "iva"])

    def test_la_rige_desde_de_lo_oficial_no_es_futura(self):
        for clave, r in DATOS["reglas"].items():
            if r["nivel"] == "oficial" and r.get("rige_desde"):
                with self.subTest(regla=clave):
                    self.assertLessEqual(date.fromisoformat(r["rige_desde"]), date.today())


if __name__ == "__main__":
    unittest.main()
