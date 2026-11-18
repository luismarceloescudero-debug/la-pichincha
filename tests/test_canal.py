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
        self.assertIn("--previo telegram-previo.json --estado _sitio/telegram.json $modo", paso)

    def test_no_sale_con_el_indexado_fallido_ni_con_alarma_de_la_guardia(self):
        # D5 (F0, docs/plan-definitivo.md): guardia.js sale con 3 para que la corrida no mande Telegram, y el paso no lo
        # miraba. Con el indexado fallido el mensaje seria del indice de ayer. El sitio se publica igual.
        paso = YML[YML.index("- name: Publicar las pichinchas"):YML.index("upload-pages-artifact")]
        condicion = paso[paso.index("if:"):paso.index("continue-on-error")]
        self.assertIn("steps.indexar.outcome != 'failure'", condicion)
        self.assertIn("steps.guardia.outputs.alarma != 'true'", condicion)
        self.assertIn("&& steps.indexar.outcome", condicion)  # se suma a los eventos, no es una alternativa (||)
        # Los ids existen en el mismo job y la guardia publica `alarma` en su salida.
        self.assertIn("id: indexar", YML)
        guardia = YML[YML.index("id: guardia"):YML.index("- name: Avisar la alarma de la guardia")]
        self.assertIn('echo "alarma=true" >> "$GITHUB_OUTPUT"', guardia)
        self.assertNotIn("se mandó igual", YML)

    def test_si_la_guardia_revienta_tambien_es_alarma_y_telegram_no_sale(self):
        # Auditoria 17/11, punto 6: con `|| rc=$?` solo el 3 marcaba alarma; si guardia.js salia con 1 (un error suyo) el
        # canal se publicaba sin medir el indice. Cualquier codigo distinto de 0 es alarma, con su texto para el issue.
        guardia = YML[YML.index("id: guardia"):YML.index("- name: Avisar la alarma de la guardia")]
        self.assertIn('if [ "$rc" -ne 0 ]; then', guardia)
        self.assertNotIn('if [ "$rc" -eq 3 ]; then echo "alarma=true"', guardia)
        self.assertIn("> alarma.md", guardia)                 # el issue y el aviso al dueno tienen que decir que fallo
        # Y si el paso entero falla antes de escribir la salida, tampoco sale.
        paso = YML[YML.index("- name: Publicar las pichinchas"):YML.index("upload-pages-artifact")]
        condicion = paso[paso.index("if:"):paso.index("continue-on-error")]
        self.assertIn("steps.guardia.outcome == 'success'", condicion)

    def test_el_respaldo_no_manda_telegram_si_la_guardia_de_hoy_dio_alarma(self):
        # Auditoria 17/11, punto 1: la corrida de las 00:23 da alarma y no manda Telegram; la de las 02:47 rearma el indice
        # (el sitio puede salir de nuevo) pero el canal de ese dia no se publica: lo decide el dueno mirando el issue.
        decidir = YML[YML.index("  decidir:"):YML.index("  tests:")]
        self.assertIn("telegram: ${{ steps.hoy.outputs.telegram }}", decidir)
        self.assertIn("alarma guardia.json", decidir)
        self.assertIn('echo "telegram=$telegram" >> "$GITHUB_OUTPUT"', decidir)
        paso = YML[YML.index("- name: Publicar las pichinchas"):YML.index("upload-pages-artifact")]
        condicion = paso[paso.index("if:"):paso.index("continue-on-error")]
        self.assertIn("needs.decidir.outputs.telegram != 'false'", condicion)

    def test_el_mensaje_anterior_se_conserva_aunque_no_se_publique(self):
        # Revision del 24/10: con alarma (paso salteado) o en un push sin nada que corregir, telegram.json desaparecia del sitio.
        paso = YML[YML.index("Conservar el mensaje de Telegram anterior"):YML.index("- name: Guardia del indice")]
        self.assertNotIn("if:", paso)
        self.assertIn('"$base/telegram.json" -o telegram-previo.json', paso)
        self.assertIn('shutil.copy("telegram-previo.json", "_sitio/telegram.json")', paso)
        self.assertLess(YML.index("Conservar el mensaje de Telegram anterior"), YML.index("Publicar las pichinchas"))


class Horario(unittest.TestCase):
    def test_dos_cron_en_minutos_sueltos_y_el_respaldo_no_repite_el_indice_del_dia(self):
        # GitHub atrasa los cron de hora en punto: con "0 12" las corridas arrancaron entre las 11:56 y las 15:19.
        crons = [l.split('"')[1] for l in YML.splitlines() if l.strip().startswith("- cron:")]
        # 0 = sin cron (decision del dueno, 02/11); si se vuelve a programar, tienen que ser los dos de siempre
        self.assertIn(len(crons), (0, 2))
        self.assertTrue(all(c.split()[0] not in ("0", "30") for c in crons))
        self.assertTrue(all(int(c.split()[1]) <= 11 for c in crons))       # antes de las 08:00 en Argentina
        construir = YML[YML.index("  construir:"):YML.index("    steps:", YML.index("  construir:"))]
        self.assertIn("decidir", construir)
        self.assertIn("needs.decidir.outputs.correr == 'true'", construir)
        decidir = YML[YML.index("  decidir:"):YML.index("  tests:")]
        self.assertIn("dia guardia.json", decidir)
        self.assertIn("dia telegram.json", decidir)       # sin el mensaje de hoy, el respaldo corre igual
        self.assertIn("America/Argentina/Buenos_Aires", decidir)


class AnunciadoEnLasPaginas(unittest.TestCase):
    def test_el_sitio_anuncia_el_feed_para_los_lectores_de_rss(self):
        html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.assertIn('<link rel="alternate" type="application/rss+xml" title="Ofertas de La Pichincha" href="ofertas.xml">', html)


if __name__ == "__main__":
    unittest.main()
