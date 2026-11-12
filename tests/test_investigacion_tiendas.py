"""La ficha de la tienda (docs/investigacion-tiendas.md) se escribe a mano, pero sus numeros tienen reglas duras:
Play corta el titulo a 30 caracteres, la descripcion corta a 80 y la larga a 4.000, y castiga repetir palabras.
Estos tests leen el bloque ```json-propuesta del documento y frenan el PR si la propuesta se pasa o no mide nada.

Corre con: python -m unittest tests.test_investigacion_tiendas
"""

import json
import re
import unicodedata
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
DOC = RAIZ / "docs" / "investigacion-tiendas.md"

# Topes de Google Play (ficha de la tienda): titulo 30, descripcion corta 80, larga 4.000.
TOPE_TITULO = 30
TOPE_CORTA = 80
TOPE_LARGA = 4000
# «Sin repetirlas de mas»: una palabra clave puede aparecer hasta 3 veces en la descripcion larga.
REPETICIONES_MAX = 3
# Palabras que no cuentan como clave cuando se busca si el titulo repite.
VACIAS = {"de", "del", "la", "el", "los", "las", "y", "en", "para", "con", "a", "al", "por", "un", "una", "tu", "que"}


def sin_tildes(texto):
    """Minusculas y sin acentos: «Placa de Vídeo» y «placa de video» son la misma palabra clave."""
    descompuesto = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


def palabras_de(texto):
    return [p for p in re.findall(r"[a-z0-9]+", sin_tildes(texto)) if p not in VACIAS]


class PropuestaParaPlay(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.texto = DOC.read_text(encoding="utf-8")
        bloques = re.findall(r"```json-propuesta\n(.*?)```", cls.texto, re.S)
        assert len(bloques) == 1, f"tiene que haber un solo bloque json-propuesta, hay {len(bloques)}"
        cls.propuesta = json.loads(bloques[0])
        # La descripcion larga va como lista de lineas para que se lea en el documento y se mida aca.
        if isinstance(cls.propuesta["larga"], list):
            cls.propuesta["larga"] = "\n".join(cls.propuesta["larga"])

    def test_el_titulo_entra_en_los_30_caracteres_de_play(self):
        titulo = self.propuesta["titulo"]
        self.assertTrue(titulo.strip())
        self.assertLessEqual(len(titulo), TOPE_TITULO, f"«{titulo}» tiene {len(titulo)} caracteres")

    def test_la_descripcion_corta_entra_en_los_80(self):
        corta = self.propuesta["corta"]
        self.assertTrue(corta.strip())
        self.assertLessEqual(len(corta), TOPE_CORTA, f"«{corta}» tiene {len(corta)} caracteres")

    def test_la_descripcion_larga_entra_en_los_4000(self):
        larga = self.propuesta["larga"]
        # Una ficha vacia tambien entra en 4.000: se pide un texto de verdad.
        self.assertGreater(len(larga), 1200, "la descripcion larga quedo demasiado corta para una ficha")
        self.assertLessEqual(len(larga), TOPE_LARGA, f"tiene {len(larga)} caracteres")

    def test_cada_palabra_elegida_aparece_en_la_descripcion_larga(self):
        larga = sin_tildes(self.propuesta["larga"])
        for clave in self.propuesta["palabras"]:
            self.assertIn(sin_tildes(clave), larga, f"falta la palabra clave «{clave}»")

    def test_no_repite_las_palabras_de_mas(self):
        larga = sin_tildes(self.propuesta["larga"])
        for clave in self.propuesta["palabras"]:
            veces = larga.count(sin_tildes(clave))
            self.assertLessEqual(veces, REPETICIONES_MAX, f"«{clave}» aparece {veces} veces en la descripcion larga")

    def test_el_titulo_no_repite_palabras(self):
        palabras = palabras_de(self.propuesta["titulo"])
        self.assertEqual(len(palabras), len(set(palabras)), f"el titulo repite palabras: {palabras}")

    def test_las_palabras_salen_de_una_busqueda_medida(self):
        # Cada palabra clave tiene que estar en el cuadro de sugerencias medidas, no inventada.
        medido = sin_tildes(self.texto)
        for clave in self.propuesta["palabras"]:
            self.assertIn(sin_tildes(clave), medido)


class FichasDeRivales(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.texto = DOC.read_text(encoding="utf-8")

    def test_hay_al_menos_cinco_fichas_de_play_medidas(self):
        fichas = re.findall(r"play\.google\.com/store/apps/details\?id=([A-Za-z0-9_.]+)", self.texto)
        self.assertGreaterEqual(len(set(fichas)), 5, f"fichas medidas: {sorted(set(fichas))}")

    def test_cada_ficha_dice_la_fecha_en_que_se_midio(self):
        self.assertRegex(self.texto, r"medid[oa]s? el \d{1,2}/\d{1,2}/\d{4}")

    def test_dice_que_no_se_pudo_medir_y_por_que(self):
        # Sin esto, la ficha parece completa cuando le faltan Search Console, GoatCounter y las resenas.
        bajo = sin_tildes(self.texto)
        for fuente in ("search console", "goatcounter", "app_suggest", "no se pudo"):
            self.assertIn(fuente, bajo, f"falta aclarar el limite de «{fuente}»")


class Encuesta(unittest.TestCase):
    def test_tiene_tres_preguntas_numeradas(self):
        texto = DOC.read_text(encoding="utf-8")
        titulo = re.search(r"^## .*[Ee]ncuesta.*$", texto, re.M)
        self.assertIsNotNone(titulo, "falta la seccion de la encuesta")
        resto = texto[titulo.end():]
        siguiente = re.search(r"^## ", resto, re.M)
        seccion = resto[:siguiente.start()] if siguiente else resto
        preguntas = re.findall(r"^\s*\d\.\s+.+\?$", seccion, re.M)
        self.assertEqual(len(preguntas), 3, f"preguntas encontradas: {preguntas}")


if __name__ == "__main__":
    unittest.main()
