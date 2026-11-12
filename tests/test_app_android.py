"""La app Android (TWA, fase 3 del plan v4): el paquete, la huella de firma y el assetlinks.json.

La app es el mismo sitio envuelto, asi que lo unico que hay que sostener en el repo es el contrato con
Google: el paquete `ar.com.pichinchadeldia.app`, la huella SHA-256 del certificado de firma en
`sitio.json` y el archivo `/.well-known/assetlinks.json` que `publicar_app.py` deja en el sitio.
Sin ese archivo (o con una huella que no coincide) la app abre con la barra del navegador arriba.
"""

import io
import json
import re
import shutil
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from urllib.parse import urljoin, urlparse

RAIZ = Path(__file__).resolve().parent.parent
PAQUETE = "ar.com.pichinchadeldia.app"
HUELLA = ":".join(["AB"] * 32)          # 32 pares en mayusculas: como la imprime keytool
RELACION = "delegate_permission/common.handle_all_urls"


def correr(argumentos):
    """Corre publicar_app.main y devuelve lo que imprimio."""
    import publicar_app

    salida = io.StringIO()
    with redirect_stdout(salida):
        publicar_app.main(argumentos)
    return salida.getvalue()


class ConfiguracionDelPaquete(unittest.TestCase):
    """El paquete y la huella viven en sitio.json: la huella no es un secreto, es la parte publica del certificado."""

    def setUp(self):
        self.sitio = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))
        self.app = self.sitio["app_android"]

    def test_el_paquete_es_el_que_va_a_quedar_registrado_en_Play(self):
        self.assertEqual(self.app["paquete"], PAQUETE)

    def test_las_huellas_son_sha256_en_mayusculas_o_una_lista_vacia(self):
        # Vacia = la app todavia no verifica el dominio (no hay cuenta de Play ni clave de subida).
        huellas = self.app["huellas_sha256"]
        self.assertIsInstance(huellas, list)
        for huella in huellas:
            self.assertRegex(huella, r"^([0-9A-F]{2}:){31}[0-9A-F]{2}$")

    def test_dice_de_donde_sale_la_huella(self):
        self.assertIn("_nota_app_android", self.sitio)


class Assetlinks(unittest.TestCase):
    """publicar_app.py deja /.well-known/assetlinks.json en el sitio publicado."""

    def setUp(self):
        import publicar_app

        self.publicar = publicar_app
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.salida = self.dir / "_sitio"

    def escribir(self, huellas):
        app = {"paquete": PAQUETE, "huellas_sha256": huellas}
        salida = io.StringIO()
        with redirect_stdout(salida):
            escritas = self.publicar.escribir_assetlinks(self.salida, app)
        return escritas, salida.getvalue()

    def leer(self):
        return json.loads((self.salida / ".well-known" / "assetlinks.json").read_text(encoding="utf-8"))

    def test_el_archivo_queda_en_well_known_con_la_relacion_y_el_paquete(self):
        self.escribir([HUELLA])
        declaracion = self.leer()
        self.assertEqual(len(declaracion), 1)
        self.assertEqual(declaracion[0]["relation"], [RELACION])
        self.assertEqual(declaracion[0]["target"]["namespace"], "android_app")
        self.assertEqual(declaracion[0]["target"]["package_name"], PAQUETE)

    def test_las_huellas_son_las_de_sitio_json(self):
        escritas, _ = self.escribir([HUELLA])
        self.assertEqual(escritas, [HUELLA])
        self.assertEqual(self.leer()[0]["target"]["sha256_cert_fingerprints"], [HUELLA])

    def test_sin_huellas_igual_deja_el_archivo_y_avisa(self):
        escritas, salida = self.escribir([])
        self.assertEqual(escritas, [])
        self.assertTrue((self.salida / ".well-known" / "assetlinks.json").exists())
        self.assertEqual(self.leer()[0]["target"]["sha256_cert_fingerprints"], [])
        self.assertIn("::warning::", salida)                 # la app no va a verificar el dominio
        self.assertIn("sitio.json", salida)                  # y dice donde se carga la huella

    def test_una_huella_con_formato_raro_no_se_publica(self):
        escritas, salida = self.escribir([HUELLA, "no-es-una-huella"])
        self.assertEqual(escritas, [HUELLA])
        self.assertEqual(self.leer()[0]["target"]["sha256_cert_fingerprints"], [HUELLA])
        self.assertIn("::warning::", salida)

    def test_pone_nojekyll_para_que_pages_sirva_la_carpeta_con_punto(self):
        self.escribir([HUELLA])
        self.assertTrue((self.salida / ".nojekyll").exists())

    def test_correrlo_dos_veces_no_falla_ni_duplica(self):
        self.escribir([HUELLA])
        self.escribir([HUELLA])
        self.assertEqual(len(self.leer()), 1)

    def test_publicar_lo_hace_todo_de_una(self):
        indice = self.dir / "indice.json"
        indice.write_text(json.dumps({"generado": "2026-11-12T09:00-03:00", "productos": []}), encoding="utf-8")
        salida = correr(["--salida", str(self.salida), "--commit", "abc1234", "--indice", str(indice)])
        self.assertTrue((self.salida / ".well-known" / "assetlinks.json").exists())
        self.assertTrue((self.salida / ".nojekyll").exists())
        self.assertIn("assetlinks", salida)


class SinSitioJSON(unittest.TestCase):
    """Si sitio.json no se puede leer, el sitio se publica igual: la app no puede frenar la publicacion."""

    def test_leer_sitio_devuelve_vacio_si_no_esta(self):
        import publicar_app

        self.assertEqual(publicar_app.leer_sitio(Path("no-existe.json")), {})

    def test_sin_sitio_json_igual_escribe_el_assetlinks_con_el_paquete_por_defecto(self):
        import publicar_app

        app = publicar_app.app_android({})
        self.assertEqual(app["paquete"], PAQUETE)
        self.assertEqual(app["huellas_sha256"], [])


class ManifiestoDeLaApp(unittest.TestCase):
    """app-android/twa-manifest.json es lo que lee Bubblewrap: tiene que decir lo mismo que el sitio."""

    def setUp(self):
        self.twa = json.loads((RAIZ / "app-android" / "twa-manifest.json").read_text(encoding="utf-8"))
        self.sitio = json.loads((RAIZ / "sitio.json").read_text(encoding="utf-8"))
        self.web = json.loads((RAIZ / "manifest.webmanifest").read_text(encoding="utf-8"))
        self.base = self.sitio["base_url"].rstrip("/")

    def test_el_paquete_es_el_de_sitio_json(self):
        self.assertEqual(self.twa["packageId"], self.sitio["app_android"]["paquete"])

    def test_el_host_es_el_del_sitio(self):
        self.assertEqual(self.twa["host"], urlparse(self.base).netloc)

    def test_apunta_al_manifiesto_publicado(self):
        self.assertEqual(self.twa["webManifestUrl"], f"{self.base}/manifest.webmanifest")
        self.assertEqual(self.twa["fullScopeUrl"], f"{self.base}/")
        self.assertTrue(self.twa["startUrl"].startswith("/"))

    def test_los_accesos_directos_y_la_orientacion_son_los_del_sitio(self):
        # Bubblewrap arma la app desde este archivo, no desde el manifiesto web: si no coinciden, la app sale sin los
        # accesos directos del sitio (revision final, 12/11).
        self.assertEqual(self.twa["orientation"], self.web["orientation"])
        web = [(s["name"], s["short_name"], urljoin(self.base + "/", s["url"])) for s in self.web["shortcuts"]]
        twa = [(s["name"], s["shortName"], s["url"]) for s in self.twa["shortcuts"]]
        self.assertEqual(twa, web)

    def test_el_nombre_y_el_boton_se_llaman_como_el_sitio(self):
        self.assertEqual(self.twa["name"], self.web["name"])
        self.assertEqual(self.twa["launcherName"], self.web["short_name"])
        self.assertLessEqual(len(self.twa["launcherName"]), 12)      # lo que entra abajo del icono

    def test_los_colores_y_la_pantalla_son_los_del_sitio(self):
        self.assertEqual(self.twa["display"], self.web["display"])
        self.assertEqual(self.twa["themeColor"].lower(), self.web["theme_color"].lower())
        self.assertEqual(self.twa["backgroundColor"].lower(), self.web["background_color"].lower())
        self.assertEqual(self.twa["navigationColor"].lower(), self.web["background_color"].lower())

    def test_el_icono_grande_es_el_que_esta_en_el_repo(self):
        self.assertEqual(self.twa["iconUrl"], f"{self.base}/img/icono-512.png")
        self.assertTrue((RAIZ / "img" / "icono-512.png").exists())
        self.assertTrue(self.twa["maskableIconUrl"].endswith("/img/icono-maskable-512.png"))

    def test_las_notificaciones_quedan_prendidas(self):
        # Las alertas de precio son el motivo para instalar la app (plan v4, 3.4).
        self.assertTrue(self.twa["enableNotifications"])

    def test_la_version_es_un_entero_que_solo_sube(self):
        self.assertIsInstance(self.twa["appVersionCode"], int)
        self.assertGreaterEqual(self.twa["appVersionCode"], 1)
        self.assertRegex(self.twa["appVersionName"], r"^\d+\.\d+\.\d+$")

    def test_no_hay_ninguna_clave_de_firma_en_el_repo(self):
        clave = self.twa["signingKey"]["path"]
        self.assertFalse(Path(clave).is_absolute(), clave)
        self.assertFalse((RAIZ / "app-android" / clave).exists(), "la clave de subida no se commitea")
        self.assertEqual(len(list((RAIZ / "app-android").glob("*.keystore"))), 0)
        self.assertEqual(len(list((RAIZ / "app-android").glob("*.jks"))), 0)

    def test_las_huellas_salen_de_sitio_json_y_no_del_manifiesto(self):
        # Una sola fuente: si se cargan las dos, una queda vieja.
        self.assertEqual(self.twa.get("fingerprints", []), [])


class EnLaAction(unittest.TestCase):
    """app.yml compila y firma el AAB; subirlo a Play es a mano (decision del dueno)."""

    def setUp(self):
        self.yml = (RAIZ / ".github" / "workflows" / "app.yml").read_text(encoding="utf-8")

    def test_no_corre_solo_con_un_push_a_main(self):
        self.assertIn("workflow_dispatch:", self.yml)
        self.assertIn("app-v*", self.yml)
        self.assertNotRegex(self.yml, r"(?m)^\s+branches:\s*\[?main")

    def test_firma_con_los_secretos_y_no_los_imprime(self):
        self.assertIn("secrets.PLAY_UPLOAD_KEYSTORE", self.yml)
        self.assertIn("secrets.PLAY_UPLOAD_PASSWORD", self.yml)
        self.assertNotRegex(self.yml, r"echo\s+\"?\$\{?PLAY_UPLOAD_PASSWORD")

    def test_deja_el_aab_y_la_huella_para_bajar(self):
        self.assertIn("upload-artifact", self.yml)
        self.assertIn("bubblewrap build", self.yml)
        self.assertIn("SHA256", self.yml)

    def test_sin_secretos_avisa_y_compila_con_una_clave_de_prueba(self):
        self.assertIn("::warning::", self.yml)
        self.assertIn("keytool -genkeypair", self.yml)

    def test_no_publica_en_la_tienda_solo(self):
        self.assertNotIn("upload-google-play", self.yml)
        self.assertIn("Play Console", self.yml)

    def test_pide_los_permisos_justos(self):
        self.assertIn("contents: read", self.yml)
        self.assertNotIn("contents: write", self.yml)

    def test_la_version_de_bubblewrap_es_exacta(self):
        self.assertRegex(self.yml, r"@bubblewrap/cli@\d+\.\d+\.\d+")
        self.assertNotIn("@latest", self.yml)


class Documentacion(unittest.TestCase):
    def test_la_carpeta_de_la_app_explica_como_se_arma(self):
        readme = (RAIZ / "app-android" / "README.md").read_text(encoding="utf-8")
        for tema in ("Bubblewrap", "assetlinks", "PLAY_UPLOAD_KEYSTORE", "huellas_sha256"):
            self.assertIn(tema, readme)
