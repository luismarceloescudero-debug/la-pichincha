import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
YML = (RAIZ / ".github" / "workflows" / "actualizar.yml").read_text(encoding="utf-8")


class EnLaAction(unittest.TestCase):
    def test_el_feed_se_arma_antes_de_subir_el_sitio_y_si_falla_el_sitio_sale_igual(self):
        self.assertIn("node generar_feed.js --indice indice.json --salida _sitio", YML)
        self.assertLess(YML.index("generar_feed.js"), YML.index("upload-pages-artifact"))
        paso = YML[YML.index("Armar el feed de ofertas"):YML.index("Publicar las pichinchas")]
        self.assertIn("::warning::", paso)

    def test_telegram_solo_en_la_corrida_programada_con_los_secretos_y_sin_frenar_el_sitio(self):
        paso = YML[YML.index("Publicar las pichinchas"):YML.index("upload-pages-artifact")]
        self.assertIn("github.event_name == 'schedule'", paso)
        self.assertIn("secrets.TELEGRAM_BOT_TOKEN", paso)
        self.assertIn("secrets.TELEGRAM_CHAT_ID", paso)
        self.assertIn("python publicar_telegram.py _sitio/ofertas.json", paso)
        self.assertIn("continue-on-error: true", paso)


class AnunciadoEnLasPaginas(unittest.TestCase):
    def test_el_sitio_anuncia_el_feed_para_los_lectores_de_rss(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="alternate" type="application/rss+xml" title="Ofertas de La Pichincha" href="ofertas.xml">', html)


if __name__ == "__main__":
    unittest.main()
