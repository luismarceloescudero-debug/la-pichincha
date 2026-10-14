"""Rendimiento de la portada (A3, CONSTRAINTS.md). Lighthouse mostro dos causas, medidas el 14/10/2026:

- CLS 0,19: #sello nace con un texto corto y el JS lo completa ("... · 12 productos seguidos · 4 sin
  verificar"), que en el telefono ocupa tres lineas y empuja el titulo. Se reservan esas lineas.
- LCP 3,4 s: el LCP es la foto de la primera tarjeta, que se pedia con loading="lazy".
"""

import re
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSS = (RAIZ / "css" / "sitio.css").read_text(encoding="utf-8")
VISTAS = (RAIZ / "js" / "vistas.js").read_text(encoding="utf-8")


class SinSaltos(unittest.TestCase):
    def test_el_sello_reserva_sus_lineas_en_cada_ancho(self):
        self.assertRegex(CSS, r"#sello\{[^}]*min-height:1lh")
        self.assertRegex(CSS, r"@media \(max-width:820px\)\{#sello\{min-height:2lh\}\}")
        self.assertRegex(CSS, r"@media \(max-width:440px\)\{#sello\{min-height:3lh\}\}")


class PrimeraFoto(unittest.TestCase):
    def test_las_primeras_tarjetas_piden_su_foto_enseguida(self):
        tarjeta = VISTAS[VISTAS.index("function tarjeta("):VISTAS.index("function", VISTAS.index("function tarjeta(") + 10)]
        self.assertIn('loading="${i < 2 ? "eager" : "lazy"}"', tarjeta)
        self.assertIn('${i === 0 ? \' fetchpriority="high"\' : ""}', tarjeta)
        self.assertNotRegex(tarjeta, r'<img src="\$\{p\.img\}" alt="\$\{esc\(p\.nombre\)\}" loading="lazy">')


class Fuentes(unittest.TestCase):
    """Con display=swap, la fuente que llega tarde vuelve a pintar el texto: el LCP se corrio a 3,3 s y la
    portada salto (CLS 0,07). Con display=optional, si no llega enseguida esa visita usa la del sistema."""

    def test_las_fuentes_no_se_cambian_despues_de_pintar(self):
        for nombre in ("index.html", "generar_paginas.js"):
            texto = (RAIZ / nombre).read_text(encoding="utf-8")
            with self.subTest(archivo=nombre):
                self.assertNotIn("display=swap", texto)
                self.assertIn("display=optional", texto)


if __name__ == "__main__":
    unittest.main()
