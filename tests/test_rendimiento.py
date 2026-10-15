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


class VistaReservada(unittest.TestCase):
    """Con la CPU lenta del runner el navegador pinta antes de que el JS llene #vista, y el pie (p.nota)
    salta hacia abajo (CLS 0,067). #vista ocupa una pantalla desde el principio: el pie nace fuera de vista."""

    def test_la_vista_ocupa_una_pantalla_antes_de_que_la_llene_el_js(self):
        self.assertRegex(CSS, r"#vista\{min-height:100vh\}")


class PortadaPreRenderizada(unittest.TestCase):
    """En la CPU del runner, armar la portada con JS al abrir costaba 560-800 ms de TBT y el LCP esperaba
    al JS. El build la deja escrita (generar_portada.js) en el sitio que se publica y en el que mide
    Lighthouse, despues de copiar index.html y js/ a _sitio."""

    def test_la_vista_pre_renderizada_no_se_anima_al_entrar(self):
        # En el runner, la animacion de entrada (opacidad 0 al empezar) llevaba el LCP a 3 s; sin ella, 1,7 s.
        self.assertIn(".panel.quieta,.panel.quieta *{animation:none}", CSS)

    def test_los_dos_workflows_pre_renderizan_la_portada(self):
        for nombre, paso in (("actualizar.yml", "node generar_portada.js --salida _sitio"),
                             ("tests.yml", "node generar_portada.js --salida _sitio")):
            yml = (RAIZ / ".github" / "workflows" / nombre).read_text(encoding="utf-8")
            with self.subTest(workflow=nombre):
                self.assertIn(paso, yml)
                self.assertLess(yml.index("cp -r img js css _sitio/"), yml.index(paso))
                if nombre == "actualizar.yml":
                    self.assertLess(yml.index(paso), yml.index("upload-pages-artifact"))
                else:
                    self.assertLess(yml.index(paso), yml.index("npx --yes lighthouse"))


class MedianaDeLighthouse(unittest.TestCase):
    """La primera corrida del job sale con Chrome en frio: en el runner su primer pintado llego a tardar 1,2 s
    mas que en las siguientes (portada 86-87 contra 99-100). Se corre tres veces cada pagina y
    .github/lighthouse.js evalua la mediana, con los mismos umbrales."""

    def test_el_job_corre_tres_veces_cada_pagina_y_evalua_todas(self):
        yml = (RAIZ / ".github" / "workflows" / "tests.yml").read_text(encoding="utf-8")
        self.assertIn("for i in 1 2 3; do", yml)
        self.assertIn('nombre=$(echo "lh-${ruta:-portada}-$i" | tr -d /)', yml)
        self.assertIn("node .github/lighthouse.js lh-*.json", yml)


if __name__ == "__main__":
    unittest.main()
