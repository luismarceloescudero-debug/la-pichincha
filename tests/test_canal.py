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

    def test_un_push_solo_corrige_el_mensaje_del_mismo_indice_y_el_estado_viaja_con_el_sitio(self):
        # Spec 030: un push no manda un mensaje nuevo, pero corrige el que ya salio si cambio la lista.
        paso = YML[YML.index("Publicar las pichinchas"):YML.index("upload-pages-artifact")]
        self.assertIn('if [ "$EVENTO" = "push" ]; then modo="--solo-corregir"; fi', paso)
        self.assertIn('"$base/telegram.json" -o telegram-previo.json || echo \'{}\' > telegram-previo.json', paso)
        self.assertIn("--previo telegram-previo.json --estado _sitio/telegram.json $modo", paso)
        self.assertIn("steps.guardia.outputs.alarma != 'true'", paso)


class Horario(unittest.TestCase):
    def test_dos_cron_en_minutos_sueltos_y_el_respaldo_no_repite_el_indice_del_dia(self):
        # GitHub atrasa los cron de hora en punto: con "0 12" las corridas arrancaron entre las 11:56 y las 15:19.
        crons = [l.split('"')[1] for l in YML.splitlines() if l.strip().startswith("- cron:")]
        self.assertEqual(len(crons), 2)
        self.assertTrue(all(c.split()[0] not in ("0", "30") for c in crons))
        self.assertTrue(all(int(c.split()[1]) <= 11 for c in crons))       # antes de las 08:00 en Argentina
        construir = YML[YML.index("  construir:"):YML.index("    steps:", YML.index("  construir:"))]
        self.assertIn("decidir", construir)
        self.assertIn("needs.decidir.outputs.correr == 'true'", construir)
        decidir = YML[YML.index("  decidir:"):YML.index("  tests:")]
        self.assertIn('"$base/guardia.json"', decidir)
        self.assertIn("America/Argentina/Buenos_Aires", decidir)


class AnunciadoEnLasPaginas(unittest.TestCase):
    def test_el_sitio_anuncia_el_feed_para_los_lectores_de_rss(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="alternate" type="application/rss+xml" title="Ofertas de La Pichincha" href="ofertas.xml">', html)


if __name__ == "__main__":
    unittest.main()
