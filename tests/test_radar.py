import io
import json
import os
import tempfile
import unittest
import urllib.error
from datetime import date
from pathlib import Path
from unittest import mock

import radar

import socket

FIX = Path(__file__).parent / "fixtures" / "radar"
TAVILY = json.loads((FIX / "tavily.json").read_text(encoding="utf-8"))
FICHA = (FIX / "ficha-jsonld.html").read_text(encoding="utf-8")

PUBLICA = "93.184.216.34"
IPS = {"privada.ar": "10.0.0.5", "metadatos.ar": "169.254.169.254", "loop.ar": "::1", "lan.ar": "192.168.1.10"}


def resolver(host, *a, **k):
    """getaddrinfo sin red: los hosts de IPS dan su IP; "nx.ar" no existe; el resto, una IP publica."""
    if host == "nx.ar":
        raise socket.gaierror(-2, "Name or service not known")
    ip = IPS.get(host, host if host[0].isdigit() or ":" in host else PUBLICA)
    return [(socket.AF_INET6 if ":" in ip else socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, 443))]


_sin_dns = mock.patch("socket.getaddrinfo", resolver)


def setUpModule():
    _sin_dns.start()   # ningun test de este archivo resuelve DNS de verdad (url_publica, B2)


def tearDownModule():
    _sin_dns.stop()

INDICE = {"generado": "2026-11-17T09:58-03:00", "productos": [
    ["Placa De Video GeForce RTX 5060 8Gb Msi Gaming Oc", 1,
     "https://www.mexx.com.ar/productos-rubro/placas-de-video/49637-placa-de-video-geforce-rtx-5060-8gb-msi-gaming-oc.html",
     "mexx"],
    ["Monitor", 1, "https://www.gamingcity.com.ar/monitor-x--det--1", "comparaya"],
    ["Micro", 1, "https://www.maximus.com.ar/Producto/otro/ITEM=1/maximus.aspx", "comparaya"],
    ["Micro 2", 1, "https://www.maximus.com.ar/Producto/otro2/ITEM=2/maximus.aspx", "maximus"],
    ["Moto", 1, "https://www.mercadolibre.com.ar/p/MLA1", "mercadolibre"],
    ["Moto Edge 60", 1, "https://www.motorola.com.ar/motorola-edge-60/p", "motorola"],
    ["sin url"],
]}
TIENDAS = {"_nota": "x", "fullh4rd": {"nombre": "FullH4rd", "base": "https://fullh4rd.com.ar"}}


def resultados():
    return [{"q": "rtx 5070", "url": r["url"], "title": r["title"]} for r in TAVILY["results"]]


class Clasificar(unittest.TestCase):
    def test_fichas(self):
        for url in ("https://fullh4rd.com.ar/prod/30374/placa-de-video-geforce-rtx-5070",
                    "https://www.maximus.com.ar/Producto/Micro-AMD/ITEM=15683/maximus.aspx",
                    "https://logg.com.ar/ProductDetail/RTX-5070-12G-GAMING-TRIO-OC",
                    "https://www.ethergaming.com.ar/productos/pc-armada-ryzen-7",
                    "https://www.motorola.com.ar/motorola-edge-60/p",
                    "https://tienda.claro.com.ar/pdp/equipos/motorola-edge-60-5g",
                    "https://spacegamer.com.ar/508590-componentes-de-pc-msi-placa-video-rtx-5060",
                    "https://www.comeros.com.ar/tienda/ssd-nvme-2tb-hiksemi-future-lite-7100mbs"):
            self.assertEqual(radar.clasificar(url), "ficha", url)

    def test_listados_y_categorias(self):
        for url in ("https://www.maximus.com.ar/Productos/Memorias/maximus.aspx?%2FCAT=50",
                    "https://compragamer.com/productos?cate=6", "https://fullh4rd.com.ar/pcarmada",
                    "https://www.gamingcity.com.ar/monitores--prod--32", "https://katech.com.ar/categoria/memoria-ram-ddr5",
                    "https://www.xt-pc.com.ar/tag/rtx", "https://www.fravega.com/l/informatica/monitores",
                    "https://tienda.claro.com.ar/plp/celulares-samsung", "https://notebookspro.ar/mejores-notebooks-ryzen-7",
                    "https://gezatek.com.ar/almacenamiento/discos-ssd-m2-nvme", "https://ipoint.com.ar/5-iphone",
                    "https://www.mexx.com.ar/productos-rubro/monitores?all=1", "https://listado.mercadolibre.com.ar/rtx-5070"):
            self.assertEqual(radar.clasificar(url), "listado", url)
        self.assertEqual(radar.clasificar("https://x.com.ar/algo", "Rtx | MercadoLibre"), "listado")

    def test_no_tiendas(self):
        for url in ("https://www.youtube.com/watch?v=1", "https://m.facebook.com/x", "https://soloprecio.com.ar/precio/x",
                    "https://www.infobae.com/tecno/x", "no es una url", ""):
            self.assertEqual(radar.clasificar(url), "no-tienda", url)

    def test_normalizar_saca_www_query_y_barra(self):
        self.assertEqual(radar.normalizar("https://WWW.Mexx.com.ar/A/b/?x=1"), "mexx.com.ar/a/b")
        self.assertEqual(radar.dominio("http://[::1"), "")


class Comparar(unittest.TestCase):
    def setUp(self):
        self.urls, self.doms = radar.conocidas(INDICE, TIENDAS)

    def test_conocidas_prefiere_la_fuente_directa_y_suma_tiendas_json(self):
        self.assertEqual(self.doms["maximus.com.ar"], "maximus")
        self.assertEqual(self.doms["gamingcity.com.ar"], "comparaya")
        self.assertEqual(self.doms["fullh4rd.com.ar"], "fullh4rd")
        self.assertEqual(len(self.urls), 6)

    def test_huecos_por_tienda_y_candidatas(self):
        r = radar.comparar(resultados() + resultados(), self.urls, self.doms)
        huecos = {h["tienda"]: h for h in r["huecos"]}
        self.assertEqual(set(huecos), {"mexx.com.ar", "fullh4rd.com.ar", "maximus.com.ar"})
        self.assertEqual(huecos["mexx.com.ar"]["faltan"], 1)  # la 5060 ya esta en el indice
        self.assertEqual(huecos["maximus.com.ar"]["fuente"], "maximus")
        cand = [c["dominio"] for c in r["candidatas"]]
        # una ficha cada una: primero las que ademas aparecen con un listado
        self.assertEqual(cand, ["logg.com.ar", "tienda.claro.com.ar", "710tech.com.ar", "ethergaming.com.ar"])
        self.assertEqual(r["candidatas"][0]["apariciones"], 2)
        self.assertNotIn("notebookspro.ar", cand)  # solo guias y categorias
        self.assertNotIn("ipoint.com.ar", cand)
        c = r["conteo"]
        self.assertEqual(c["en_indice"], 2)
        self.assertEqual(c["no_tienda"], 4)
        self.assertEqual(sum(c.values()), len(TAVILY["results"]))  # los repetidos no cuentan dos veces

    def test_elegir_consultas_rota_por_semana(self):
        consultas = [{"q": f"t{i}"} for i in range(50)]
        a, b = radar.elegir_consultas(consultas, 1), radar.elegir_consultas(consultas, 2)
        self.assertEqual(len(a), radar.MAX_CONSULTAS)
        self.assertNotEqual(a[0], b[0])
        self.assertEqual(radar.elegir_consultas(["a", "b"], 7), ["a", "b"] + radar.EXTRA)


def http_error(code):
    return urllib.error.HTTPError("https://x", code, "x", {}, io.BytesIO(b""))


class Buscar(unittest.TestCase):
    def test_corta_al_tope_de_creditos(self):
        llamadas = []

        def post(url, cuerpo, clave, timeout=60):
            llamadas.append(cuerpo)
            self.assertEqual(cuerpo["search_depth"], "basic")
            return {"usage": {"credits": 2}, "results": TAVILY["results"][:2]}

        b = radar.buscar(["a", "b", "c", "d"], "k", tope=4, post=post)
        self.assertEqual((b["consultas"], b["creditos"], len(b["resultados"])), (2, 4, 4))
        self.assertEqual(llamadas[0]["query"], "a precio Argentina")

    def test_errores_no_frenan_salvo_clave_o_cupo(self):
        respuestas = [urllib.error.URLError("caida"), http_error(500), {"results": []}, http_error(432), {"results": []}]

        def post(*a, **k):
            r = respuestas.pop(0)
            if isinstance(r, Exception):
                raise r
            return r

        b = radar.buscar(list("abcde"), "k", post=post)
        self.assertEqual(b["consultas"], 1)
        self.assertEqual(b["creditos"], 1)  # sin usage cuenta 1
        self.assertEqual(len(b["errores"]), 3)
        self.assertIn("HTTP 432", b["errores"][-1])


class Firecrawl(unittest.TestCase):
    def cand(self, *dominios):
        return [{"dominio": d, "ejemplos": [{"url": f"https://{d}/producto/x"}]} for d in dominios]

    def test_json_ld_product(self):
        self.assertTrue(radar.tiene_product(FICHA))
        self.assertTrue(radar.tiene_product('<script type="application/ld+json">[{"@type":"Product"}]</script>'))
        self.assertFalse(radar.tiene_product('<script type="application/ld+json">{roto</script>'))
        self.assertFalse(radar.tiene_product(None))

    def test_confirma_respetando_robots_y_bloqueos(self):
        robots = {"a.ar": "User-agent: *\nDisallow:",
                  "b.ar": "User-agent: *\nDisallow:\nUser-agent: FirecrawlAgent\nDisallow: /producto/",
                  "c.ar": http_error(404), "d.ar": urllib.error.URLError("x"), "e.ar": "", "f.ar": "", "g.ar": "",
                  "h.ar": "", "i.ar": http_error(500)}
        scrape = {"a.ar": {"data": {"rawHtml": FICHA, "metadata": {"statusCode": 200, "creditsUsed": 1}}},
                  "c.ar": {"data": {"rawHtml": "<html></html>"}},
                  "e.ar": {"data": {"rawHtml": "<div class=cf-chl></div>"}},
                  "f.ar": http_error(403), "g.ar": http_error(500), "h.ar": urllib.error.URLError("x")}
        pedidos, esperas = [], []

        def get(url, timeout=20):
            r = robots[url.split("/")[2]]
            if isinstance(r, Exception):
                raise r
            return r

        def post(url, cuerpo, clave, timeout=60):
            self.assertEqual(cuerpo["proxy"], "basic")
            pedidos.append(cuerpo["url"])
            r = scrape[cuerpo["url"].split("/")[2]]
            if isinstance(r, Exception):
                raise r
            return r

        cands = self.cand("a.ar", "b.ar", "c.ar", "d.ar", "e.ar", "f.ar", "g.ar", "h.ar", "i.ar") + [
            {"dominio": "z.ar", "ejemplos": []}]
        usados = radar.confirmar(cands, "k", post=post, get=get, dormir=esperas.append)
        estado = {c["dominio"]: c.get("firecrawl") for c in cands}
        self.assertEqual(estado["a.ar"], "ficha-confirmada")
        self.assertEqual(estado["b.ar"], "robots-prohibe")
        self.assertEqual(estado["c.ar"], "sin-json-ld")
        self.assertEqual(estado["d.ar"], "sin-robots")
        self.assertEqual(estado["e.ar"], "bloqueada")
        self.assertEqual(estado["f.ar"], "bloqueada")
        self.assertEqual(estado["g.ar"], "error-500")
        self.assertTrue(estado["h.ar"].startswith("error-red"))
        self.assertEqual(estado["i.ar"], "sin-robots")
        self.assertEqual(usados, 6, "un error de red contra Firecrawl cuenta igual (pudo haber cobrado)")
        self.assertNotIn("https://b.ar/producto/x", pedidos)
        self.assertEqual(len(esperas), 5)

    def test_url_publica_solo_https_a_ip_publica(self):
        self.assertTrue(radar.url_publica("https://tienda.com.ar/p/1"))
        for url in ("http://tienda.com.ar/p/1", "ftp://tienda.com.ar/x", "https://localhost/x",
                    "https://algo.localhost/x", "https://127.0.0.1/x", "https://[::1]/x", "https://privada.ar/x",
                    "https://metadatos.ar/latest", "https://loop.ar/x", "https://lan.ar/x", "https://nx.ar/x",
                    "https:///sin-host", "no es una url", "https://tienda.com.ar:99999/x"):
            self.assertFalse(radar.url_publica(url), url)

    def test_no_pide_robots_a_una_candidata_interna(self):
        pedidos = []
        cands = self.cand("privada.ar", "metadatos.ar") + [
            {"dominio": "h.ar", "ejemplos": [{"url": "http://h.ar/producto/x"}]}]
        get = lambda url, timeout=20: pedidos.append(url) or ""
        self.assertEqual(radar.confirmar(cands, "k", post=lambda *a, **k: {}, get=get, dormir=lambda s: 0), 0)
        self.assertEqual(pedidos, [])
        self.assertEqual({c.get("firecrawl") for c in cands}, {"url-no-publica"})

    def test_tope_de_firecrawl(self):
        post = lambda *a, **k: {"data": {"rawHtml": FICHA}}
        cands = self.cand("a.ar", "b.ar", "c.ar")
        self.assertEqual(radar.confirmar(cands, "k", maximo=2, post=post, get=lambda *a, **k: "", dormir=lambda s: 0), 2)
        self.assertNotIn("firecrawl", cands[2])


class Topes(unittest.TestCase):
    def test_los_topes_tienen_techo(self):
        post = lambda url, cuerpo, clave, timeout=60: (TAVILY if url == radar.TAVILY_URL else
                                                       {"data": {"rawHtml": FICHA, "metadata": {"statusCode": 200}}})
        r = radar.correr(INDICE, [], TIENDAS, "k", "fc", tope=5000, hoy=date(2026, 11, 23), post=post,
                         get=lambda *a, **k: "", dormir=lambda s: 0, tope_firecrawl=900)
        self.assertEqual(r["tope"], radar.TOPE_CREDITOS)
        self.assertIn("(tope " + str(radar.MAX_FIRECRAWL) + ")", r["firecrawl"])


class Corrida(unittest.TestCase):
    def post(self, url, cuerpo, clave, timeout=60):
        if url == radar.TAVILY_URL:
            return TAVILY
        return {"data": {"rawHtml": FICHA, "metadata": {"statusCode": 200}}}

    def test_correr_con_y_sin_firecrawl(self):
        sin = radar.correr(INDICE, [{"q": "rtx 5070"}], TIENDAS, "k", hoy=date(2026, 11, 23), post=self.post)
        self.assertEqual(sin["firecrawl"], "sin clave, salteado")
        self.assertEqual(sin["creditos"], len(radar.EXTRA) + 1)
        self.assertNotIn("firecrawl", sin["candidatas"][0])
        con = radar.correr(INDICE, [], TIENDAS, "k", "fc", tope=2, hoy=date(2026, 11, 23), post=self.post,
                           get=lambda *a, **k: "", dormir=lambda s: 0, tope_firecrawl=3)
        self.assertEqual(con["creditos"], 2)
        self.assertEqual(con["firecrawl"], "3 creditos (tope 3)")
        self.assertEqual(con["candidatas"][0]["firecrawl"], "ficha-confirmada")
        md = radar.informe_md(con)
        self.assertIn("**2 creditos**", md)
        self.assertIn("mexx.com.ar** (fuente mexx)", md)
        self.assertIn("firecrawl: ficha-confirmada", md)

    def test_informe_vacio_y_con_errores(self):
        r = {"fecha": "2026-11-23", "indice": "?", "consultas": 0, "creditos": 0, "tope": 60, "firecrawl": "x",
             "conteo": {}, "huecos": [], "candidatas": [], "errores": ["a: HTTP 432"]}
        md = radar.informe_md(r)
        self.assertEqual(md.count("Ninguno"), 1)
        self.assertIn("Ninguna.", md)
        self.assertIn("- a: HTTP 432", md)

    def test_main(self):
        with tempfile.TemporaryDirectory() as tmp:
            t = Path(tmp)
            (t / "indice.json").write_text(json.dumps(INDICE), encoding="utf-8")
            (t / "consultas.json").write_text(json.dumps([{"q": "rtx 5070"}]), encoding="utf-8")
            args = ["--indice", str(t / "indice.json"), "--consultas", str(t / "consultas.json"),
                    "--tiendas", str(t / "no-hay.json"), "--salida", str(t / "radar")]
            with mock.patch.dict(os.environ, {"TAVILY_API_KEY": ""}):
                self.assertEqual(radar.main(args), 1)
            original = radar.correr
            sin_red = lambda *a, **k: original(*a, post=self.post, **k)
            with mock.patch.dict(os.environ, {"TAVILY_API_KEY": "k", "FIRECRAWL_API_KEY": ""}),                     mock.patch.object(radar, "correr", sin_red):
                self.assertEqual(radar.main(args), 0)
            datos = json.loads((t / "radar" / "radar.json").read_text(encoding="utf-8"))
            self.assertEqual({h["tienda"] for h in datos["huecos"]}, {"mexx.com.ar", "maximus.com.ar"})
            self.assertIn("# Radar de cobertura", (t / "radar" / "radar.md").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
