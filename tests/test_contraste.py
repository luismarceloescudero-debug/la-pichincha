"""WCAG AA: todo color de texto del sitio contrasta al menos 4,5:1 con los fondos donde se usa, en tema
claro y en tema oscuro (CONSTRAINTS.md). Lee las variables de css/sitio.css: cambiar un color que lo
rompa hace fallar la CI."""

import re
import unittest
from pathlib import Path

CSS = (Path(__file__).resolve().parent.parent / "css" / "sitio.css").read_text(encoding="utf-8")
MINIMO = 4.5
TEXTOS = ("ink", "ink-2", "ink-3", "accent", "good", "bad", "warn")
FONDOS = ("bg", "surface", "surface-2")
CHIPS = ("cg", "gc", "mx", "fh", "cy", "vx", "mm", "tg", "mt", "kt", "sh", "ck", "gt", "good", "accent", "warn")   # color sobre su version -soft


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

    def test_el_oscuro_del_sistema_y_el_elegido_a_mano_son_iguales(self):
        inicio = CSS.index("@media (prefers-color-scheme:dark)")
        sistema = dict(re.findall(r"--([\w-]+):\s*(#[0-9a-fA-F]{6})", CSS[inicio:CSS.index("}", inicio)]))
        self.assertEqual(sistema, self.TEMAS["oscuro"])


if __name__ == "__main__":
    unittest.main()
