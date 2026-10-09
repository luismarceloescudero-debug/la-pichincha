import json
import struct
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent


def medida_png(ruta):
    cabecera = Path(ruta).read_bytes()[:24]
    return struct.unpack(">II", cabecera[16:24])


class Manifiesto(unittest.TestCase):
    def setUp(self):
        self.m = json.loads((RAIZ / "manifest.webmanifest").read_text(encoding="utf-8"))

    def test_datos_de_la_app(self):
        self.assertEqual(self.m["name"], "La Pichincha")
        self.assertEqual(self.m["lang"], "es-AR")
        self.assertEqual(self.m["display"], "standalone")
        self.assertTrue(self.m["description"])

    def test_rutas_relativas_para_que_ande_bajo_cualquier_dominio_o_carpeta(self):
        for clave in ("start_url", "scope"):
            self.assertFalse(self.m[clave].startswith(("/", "http")), clave)
        for icono in self.m["icons"]:
            self.assertFalse(icono["src"].startswith(("/", "http")), icono["src"])

    def test_los_colores_son_los_del_sitio(self):
        css = (RAIZ / "css" / "sitio.css").read_text(encoding="utf-8")
        self.assertIn(self.m["theme_color"].lower(), css.lower())
        self.assertIn(self.m["background_color"].lower(), css.lower())

    def test_los_iconos_existen_y_miden_lo_que_declaran(self):
        declarados = {(i["sizes"], i.get("purpose", "any")) for i in self.m["icons"]}
        self.assertEqual(declarados, {("192x192", "any"), ("512x512", "any"), ("512x512", "maskable")})
        for icono in self.m["icons"]:
            ancho, alto = (int(n) for n in icono["sizes"].split("x"))
            ruta = RAIZ / icono["src"]
            self.assertTrue(ruta.exists(), icono["src"])
            self.assertEqual(medida_png(ruta), (ancho, alto), icono["src"])
            self.assertLess(ruta.stat().st_size, 60 * 1024, icono["src"])

    def test_el_icono_de_apple_mide_180(self):
        self.assertEqual(medida_png(RAIZ / "img" / "apple-touch-icon.png"), (180, 180))


class SinRed(unittest.TestCase):
    """sin-red.html se sirve en la URL de OTRA pagina: nada puede depender de rutas relativas."""

    def setUp(self):
        self.html = (RAIZ / "sin-red.html").read_text(encoding="utf-8")

    def test_dice_que_no_esta_disponible_y_ofrece_volver(self):
        self.assertIn("no está disponible sin conexión", self.html)
        self.assertIn("La Pichincha", self.html)
        self.assertIn('id="volver"', self.html)

    def test_no_depende_de_rutas_relativas(self):
        import re
        self.assertNotRegex(self.html, r'(?:src|href)="(?!#|https?:)[^"]*\.(?:css|js|png)"')
        self.assertIn("<style>", self.html)

    def test_el_enlace_de_volver_se_arma_con_el_alcance_del_service_worker(self):
        self.assertIn("serviceWorker", self.html)
        self.assertIn("scope", self.html)

    def test_tiene_tema_oscuro_y_no_indexa(self):
        self.assertIn("prefers-color-scheme: dark", self.html)
        self.assertIn('name="robots" content="noindex"', self.html)


class Publicar(unittest.TestCase):
    def setUp(self):
        import shutil
        import tempfile
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.salida = self.dir / "_sitio"
        self.indice = self.dir / "indice.json"
        self.indice.write_text(json.dumps({"generado": "2026-10-09T08:12-03:00", "productos": []}), encoding="utf-8")

    def correr(self, *extra, indice=True):
        import publicar_app
        argv = ["--salida", str(self.salida), "--commit", "abc1234def"] + (["--indice", str(self.indice)] if indice else []) + list(extra)
        self.assertEqual(publicar_app.main(argv), 0)
        return (self.salida / "sw.js").read_text(encoding="utf-8")

    def test_estampa_la_version_con_la_fecha_del_indice_y_el_commit(self):
        sw = self.correr()
        self.assertIn('const VERSION = "20261009T0812-abc1234";', sw)
        self.assertNotIn("__VERSION__", sw)

    def test_sin_indice_la_version_es_solo_el_commit(self):
        self.assertIn('const VERSION = "abc1234";', self.correr(indice=False))

    def test_dos_publicaciones_con_indices_distintos_dan_versiones_distintas(self):
        a = self.correr()
        self.indice.write_text(json.dumps({"generado": "2026-10-10T08:15-03:00"}), encoding="utf-8")
        b = self.correr()
        self.assertNotEqual(a, b)

    def test_copia_manifiesto_pagina_de_sin_red_e_iconos(self):
        self.correr()
        for ruta in ("manifest.webmanifest", "sin-red.html", "img/icono-192.png", "img/icono-512.png",
                     "img/icono-maskable-512.png", "img/apple-touch-icon.png"):
            self.assertTrue((self.salida / ruta).exists(), ruta)

    def test_correrlo_dos_veces_no_falla(self):
        self.correr()
        self.correr()

    def test_el_peso_de_la_cascara_sin_el_indice_es_chico(self):
        # SC-005: menos de 10 MB sin contar el indice.
        import publicar_app
        total = sum((RAIZ / r).stat().st_size for r in publicar_app.ARCHIVOS_DE_LA_CASCARA if (RAIZ / r).exists())
        self.assertLess(total, 10 * 1024 * 1024)


class CabezaDelSitio(unittest.TestCase):
    def setUp(self):
        self.html = (RAIZ / "index.html").read_text(encoding="utf-8")

    def test_enlaza_el_manifiesto_los_colores_y_el_icono_de_apple(self):
        self.assertIn('<link rel="manifest" href="manifest.webmanifest">', self.html)
        self.assertIn('<link rel="apple-touch-icon" href="img/apple-touch-icon.png">', self.html)
        self.assertRegex(self.html, r'<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: light\)">')
        self.assertRegex(self.html, r'<meta name="theme-color" content="#[0-9a-f]{6}" media="\(prefers-color-scheme: dark\)">')

    def test_esta_dentro_de_solo_web_asi_no_va_a_la_copia_del_artifact(self):
        import re
        bloques = re.findall(r"<!-- solo-web -->.*?<!-- /solo-web -->", self.html, re.S)
        self.assertTrue(any('rel="manifest"' in b for b in bloques))

    def test_no_arma_un_cartel_propio_de_instalar(self):
        sin_comentarios = self.html
        self.assertNotIn("beforeinstallprompt", sin_comentarios)
        self.assertNotRegex(sin_comentarios.lower(), r">\s*instalar (la )?app")


class AvisoDeSinConexionEnElSitio(unittest.TestCase):
    def setUp(self):
        import re
        self.html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.sin_scripts = re.sub(r"<script\b.*?</script>", "", self.html, flags=re.S)

    def test_el_contenedor_del_aviso_esta_oculto_y_avisa_a_lectores_de_pantalla(self):
        self.assertIn('<div id="sin-red" class="sin-red" role="status" hidden></div>', self.sin_scripts)

    def test_carga_app_js_y_la_inicia_solo_si_la_pagina_esta_suelta(self):
        self.assertIn('<script src="js/app.js"></script>', self.html)
        arranque = (RAIZ / "js" / "arranque.js").read_text(encoding="utf-8")
        self.assertRegex(arranque, r"SUELTA \? App\.iniciar\(window, document,")   # no dentro del visor del artifact

    def test_la_fecha_del_aviso_sale_del_indice_y_si_no_de_los_datos(self):
        arranque = (RAIZ / "js" / "arranque.js").read_text(encoding="utf-8")
        self.assertRegex(arranque, r"generado: \(\) => \(IDX && IDX\.generado\)")

    def test_el_aviso_tiene_estilo_y_el_viejo_se_distingue(self):
        css = (RAIZ / "css" / "sitio.css").read_text(encoding="utf-8")
        self.assertIn(".sin-red{", css)
        self.assertIn('.sin-red[data-viejo="1"]', css)


class IndexPartido(unittest.TestCase):
    """index.html es solo la estructura y los datos: la logica vive en js/ y css/ (F1.1)."""

    def setUp(self):
        import re
        self.html = (RAIZ / "index.html").read_text(encoding="utf-8")
        self.scripts = re.findall(r'<script src="(js/[\w.-]+\.js)"></script>', self.html)

    def test_el_unico_script_inline_son_los_datos(self):
        import re
        inline = [s for s in re.findall(r"<script>(.*?)</script>", self.html, flags=re.S)]
        self.assertEqual(len(inline), 1)
        self.assertIn("const DATOS = ", inline[0])
        self.assertLess(len(inline[0].split("/* === FIN DATOS === */")[1].strip()), 1, "nada de logica despues de los datos")

    def test_los_datos_van_antes_que_los_modulos_que_los_usan(self):
        self.assertLess(self.html.index("const DATOS = "), self.html.index('<script src="js/base.js">'))

    def test_cada_modulo_existe_y_el_service_worker_lo_guarda(self):
        sw = (RAIZ / "sw.js").read_text(encoding="utf-8")
        self.assertGreaterEqual(len(self.scripts), 10)
        for ruta in self.scripts:
            self.assertTrue((RAIZ / ruta).exists(), ruta)
            self.assertIn(f'"{ruta}"', sw, f"{ruta} falta en la cascara del service worker")


class FuentesSinBloquear(unittest.TestCase):
    """Una hoja de estilos externa bloquea los scripts que le siguen: si las fuentes de Google tardan, el
    aviso de sin conexion tarda con ellas. Se cargan sin bloquear (media=print y onload)."""

    def comprobar(self, html):
        import re
        enlaces = re.findall(r'<link[^>]*fonts\.googleapis\.com/css2[^>]*>', html)
        self.assertEqual(len(enlaces), 2, 'uno que no bloquea y su version noscript')
        self.assertIn('media="print"', enlaces[0])
        self.assertIn("onload=\"this.media='all'\"", enlaces[0])
        self.assertRegex(html, r"<noscript><link[^>]*fonts\.googleapis\.com/css2[^>]*></noscript>")   # sin JS, como antes

    def test_index(self):
        self.comprobar((RAIZ / "index.html").read_text(encoding="utf-8"))


class EnLaAction(unittest.TestCase):
    def setUp(self):
        self.yml = (RAIZ / ".github" / "workflows" / "actualizar.yml").read_text(encoding="utf-8")

    def test_la_action_deja_lista_la_app_despues_de_generar_las_paginas(self):
        self.assertIn("python publicar_app.py --salida _sitio --indice indice.json", self.yml)
        self.assertLess(self.yml.index("generar_paginas.py"), self.yml.index("publicar_app.py"))
        self.assertLess(self.yml.index("publicar_app.py"), self.yml.index("upload-pages-artifact"))

    def test_si_falla_la_app_el_sitio_se_publica_igual(self):
        linea = [l for l in self.yml.splitlines() if "publicar_app.py" in l and "python" in l][0]
        self.assertIn("|| echo", linea)

    def test_el_sitio_copia_lo_que_necesita_la_cascara(self):
        # Todo lo que el service worker guarda tiene que existir en lo publicado.
        import re
        sw = (RAIZ / "sw.js").read_text(encoding="utf-8")
        cascara = re.findall(r'"([^"]+)"', re.search(r"const CASCARA = \[(.*?)\];", sw, re.S).group(1))
        copiados_por_publicar = {"manifest.webmanifest", "sin-red.html", "img/icono-192.png", "img/icono-512.png", "img/apple-touch-icon.png"}
        for ruta in cascara:
            en_la_raiz = ruta in ("./", "index.html", "indice.json")
            en_carpeta_copiada = ruta.split("/")[0] in ("css", "js", "img") and "cp -r img js css _sitio/" in self.yml
            self.assertTrue(en_la_raiz or en_carpeta_copiada or ruta in copiados_por_publicar, ruta)
