"""WCAG AA: todo color de texto del sitio contrasta al menos 4,5:1 con los fondos donde se usa, en tema
claro y en tema oscuro (CONSTRAINTS.md). Lee las variables de css/sitio.css: cambiar un color que lo
rompa hace fallar la CI.

Desde la auditoria del 10/11 tambien cubre los tokens del Reel (--n-*), la pastilla de la tienda en las
14 tiendas y el borde de los controles (1.4.11 pide 3:1 para el limite de un control)."""

import re
import unittest
from pathlib import Path

CSS = (Path(__file__).resolve().parent.parent / "css" / "sitio.css").read_text(encoding="utf-8")
MINIMO = 4.5
MINIMO_CONTROL = 3.0        # WCAG 1.4.11: el borde que delimita un control no es texto
TEXTOS = ("ink", "ink-2", "ink-3", "accent", "good", "bad", "warn")
FONDOS = ("bg", "surface", "surface-2")
CHIPS = ("cg", "gc", "mx", "fh", "cy", "vx", "mm", "tg", "mt", "kt", "sh", "ck", "gt", "vt", "good", "accent", "warn")   # color sobre su version -soft
# Los roles del Reel v4 (spec 060): el color con que se pinta cada parte de la tarjeta.
TEXTOS_REEL = ("n-precio", "n-rosa", "n-celeste", "n-lila", "n-menta", "n-titulo-2", "n-titulo-3")
FONDOS_REEL = ("n-tarjeta", "n-tarjeta2", "bg", "surface", "surface-2")


def variables(selector):
    inicio = CSS.index(selector)
    return dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", CSS[inicio:CSS.index("}", inicio)]))


def luminancia(color):
    canales = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    r, g, b = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in canales]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contraste(a, b):
    claro, oscuro = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (claro + 0.05) / (oscuro + 0.05)


class Contraste(unittest.TestCase):
    TEMAS = {"claro": variables(":root{"), "oscuro": variables(':root[data-theme="dark"]{')}

    def test_la_formula_da_los_valores_de_referencia(self):
        self.assertAlmostEqual(contraste("#000000", "#ffffff"), 21, places=2)
        self.assertAlmostEqual(contraste("#777777", "#ffffff"), 4.48, places=2)

    def test_los_textos_se_leen_sobre_todos_los_fondos(self):
        for tema, t in self.TEMAS.items():
            for texto in TEXTOS:
                for fondo in FONDOS:
                    with self.subTest(tema=tema, texto=texto, fondo=fondo):
                        self.assertGreaterEqual(round(contraste(t[texto], t[fondo]), 2), MINIMO)

    def test_los_chips_de_cada_tienda_se_leen(self):
        for tema, t in self.TEMAS.items():
            for color in CHIPS:
                with self.subTest(tema=tema, color=color):
                    self.assertGreaterEqual(round(contraste(t[color], t[color + "-soft"]), 2), MINIMO)

    def test_el_vendedor_dentro_del_chip_de_la_tienda_se_lee(self):
        # «Samsung Shop» en el chip de Mercado Libre: .via va sobre el -soft de cada tienda, no sobre la superficie.
        usados = re.findall(r"\.(?:fila|oferta) \.via\{color:var\(--([\w-]+)\)", CSS)
        self.assertEqual(len(usados), 2)
        for tema, t in self.TEMAS.items():
            for texto in usados:
                for color in CHIPS:
                    with self.subTest(tema=tema, texto=texto, chip=color):
                        self.assertGreaterEqual(round(contraste(t[texto], t[color + "-soft"]), 2), MINIMO)

    def test_los_colores_del_reel_se_leen_sobre_las_tarjetas(self):
        # El CSS decia que estos colores pasaban 4,5:1, pero el test no los miraba: un cambio en cualquiera de
        # los dos lados pasaba la CI igual. Ahora los dos lados estan cubiertos.
        for tema, t in self.TEMAS.items():
            for texto in TEXTOS_REEL:
                for fondo in FONDOS_REEL:
                    with self.subTest(tema=tema, texto=texto, fondo=fondo):
                        self.assertGreaterEqual(round(contraste(t[texto], t[fondo]), 2), MINIMO)

    def test_la_pastilla_de_la_tienda_se_lee_en_todas_las_tiendas(self):
        # La pastilla va llena con el color de cada tienda y letra en --n-sobre: blanco sobre los colores oscuros
        # del tema claro, casi negro sobre los claros del tema oscuro.
        for tema, t in self.TEMAS.items():
            for color in CHIPS:
                with self.subTest(tema=tema, tienda=color):
                    self.assertGreaterEqual(round(contraste(t[color], t["n-sobre"]), 2), MINIMO)

    def test_el_borde_de_un_control_se_ve_sobre_su_relleno(self):
        # Con --n-borde (1,9:1) el limite de las pastillas clicables no se veia, y el relleno tampoco alcanza
        # (--surface-2 sobre --bg da 1,1:1). Este es el que tiene que pasar 3:1.
        for tema, t in self.TEMAS.items():
            with self.subTest(tema=tema):
                self.assertGreaterEqual(round(contraste(t["n-borde-control"], t["surface-2"]), 2), MINIMO_CONTROL)

    def test_el_oscuro_del_sistema_y_el_elegido_a_mano_son_iguales(self):
        inicio = CSS.index("@media (prefers-color-scheme:dark)")
        sistema = dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", CSS[inicio:CSS.index("}", inicio)]))
        self.assertEqual(sistema, self.TEMAS["oscuro"])


if __name__ == "__main__":
    unittest.main()
