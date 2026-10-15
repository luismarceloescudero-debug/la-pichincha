import io
import json
import shutil
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from datetime import date
from pathlib import Path
from unittest import mock

import indexar

FICHA = (Path(__file__).resolve().parent / "fixtures" / "venex" / "ficha.html").read_text(encoding="utf-8")
HOY = date(2026, 10, 15)
SSD = "Disco Solido SSD Kingston A400 480GB SATA"


def tienda(**ficha):
    return {"base": "https://t.test", "ficha": {"extractor": "venex", "rubros": ["ram", "ssd"], "tope": 40, **ficha}}


def aviso(i, nombre=SSD, **resto):
    return {"nombre": nombre, "precio": 1000, "url": f"https://t.test/p{i}.html", **resto}


class Pedidos:
    """Un `pedir` de mentira: anota las URL y devuelve la ficha guardada, o levanta el error que se le diga."""

    def __init__(self, errores=None, paginas=None):
        self.urls, self.errores, self.paginas = [], errores or {}, paginas or {}

    def __call__(self, url):
        self.urls.append(url)
        if url in self.errores:
            raise self.errores[url]
        return self.paginas.get(url, FICHA)


def completar(cfg, items, cache, pedir, **kw):
    return indexar.completar_con_fichas(cfg, items, cache, HOY, pedir=pedir, dormir=kw.pop("dormir", lambda s: None), **kw)


def http(url, codigo):
    return urllib.error.HTTPError(url, codigo, "x", {}, None)


class CompletarConFichas(unittest.TestCase):
    def test_pone_el_part_number_en_el_aviso_y_lo_guarda_en_la_cache(self):
        items, cache, pedir = [aviso(1)], {}, Pedidos()
        r = completar(tienda(), items, cache, pedir)
        self.assertEqual(items[0]["sku"], "SA400S37/480G")
        self.assertEqual(cache["https://t.test/p1.html"], {"mpn": "SA400S37/480G", "dia": "2026-10-15"})
        self.assertEqual(r["pedidas"], 1)

    def test_lo_que_ya_esta_en_la_cache_no_se_vuelve_a_pedir(self):
        cache = {"https://t.test/p1.html": {"mpn": "SA400S37/480G", "dia": "2026-10-01"}}
        items, pedir = [aviso(1)], Pedidos()
        r = completar(tienda(), items, cache, pedir)
        self.assertEqual(pedir.urls, [])
        self.assertEqual(items[0]["sku"], "SA400S37/480G")
        self.assertEqual(r["pedidas"], 0)

    def test_una_ficha_sin_codigo_se_recuerda_y_se_reintenta_a_los_30_dias(self):
        sin = {"https://t.test/p1.html": "<html>sin codigo</html>"}
        cache, pedir = {}, Pedidos(paginas=sin)
        items = [aviso(1)]
        completar(tienda(), items, cache, pedir)
        self.assertEqual(cache["https://t.test/p1.html"], {"mpn": None, "dia": "2026-10-15"})
        self.assertNotIn("sku", items[0])
        completar(tienda(), [aviso(1)], cache, pedir)                       # mismo dia: no vuelve a pedir
        self.assertEqual(len(pedir.urls), 1)
        cache["https://t.test/p1.html"]["dia"] = "2026-09-15"               # hace justo 30 dias
        completar(tienda(), [aviso(1)], cache, pedir)
        self.assertEqual(len(pedir.urls), 2)

    def test_respeta_el_tope_por_corrida_y_deja_el_resto_para_la_proxima(self):
        items, cache, pedir = [aviso(i) for i in range(5)], {}, Pedidos()
        r = completar(tienda(tope=2), items, cache, pedir)
        self.assertEqual(len(pedir.urls), 2)
        self.assertEqual([("sku" in i) for i in items], [True, True, False, False, False])
        self.assertEqual((r["pedidas"], r["pendientes"]), (2, 3))
        completar(tienda(tope=2), items, cache, pedir)
        self.assertEqual(len(cache), 4)                                     # la segunda corrida sigue donde quedo

    def test_solo_pide_los_rubros_configurados_y_avisos_que_pueden_agruparse(self):
        items = [aviso(1, "Placa de video Nvidia Gigabyte RTX 5070 12GB"), aviso(2, "Mouse Logitech G203"),
                 aviso(3, "Disco Solido SSD Kingston A400 480GB usado"), aviso(4, SSD, sku="YA123X"),
                 aviso(5, "Memoria Ram DDR4 16GB Kingston Fury")]
        pedir = Pedidos()
        completar(tienda(), items, {}, pedir)
        self.assertEqual(pedir.urls, ["https://t.test/p5.html"])
        self.assertEqual(items[3]["sku"], "YA123X")                         # lo que ya traia el catalogo no se pisa

    def test_una_tienda_sin_ficha_configurada_no_pide_nada(self):
        pedir = Pedidos()
        r = completar({"base": "https://t.test"}, [aviso(1)], {}, pedir)
        self.assertEqual(pedir.urls, [])
        self.assertEqual(r, {"pedidas": 0, "pendientes": 0, "bloqueada": False})

    def test_un_bloqueo_corta_los_pedidos_pero_se_sigue_usando_la_cache(self):
        cache = {"https://t.test/p2.html": {"mpn": "SNV3S/500G", "dia": "2026-10-01"}}
        items = [aviso(1), aviso(2), aviso(3)]
        pedir = Pedidos(errores={"https://t.test/p1.html": http("https://t.test/p1.html", 403)})
        r = completar(tienda(), items, cache, pedir)
        self.assertEqual(pedir.urls, ["https://t.test/p1.html"])            # no insiste con p3
        self.assertTrue(r["bloqueada"])
        self.assertEqual([i.get("sku") for i in items], [None, "SNV3S/500G", None])
        self.assertNotIn("https://t.test/p1.html", cache)

    def test_un_error_de_red_en_una_ficha_no_se_guarda_y_sigue_con_las_demas(self):
        items = [aviso(1), aviso(2)]
        pedir = Pedidos(errores={"https://t.test/p1.html": OSError("timeout")})
        cache = {}
        r = completar(tienda(), items, cache, pedir)
        self.assertEqual(list(cache), ["https://t.test/p2.html"])
        self.assertFalse(r["bloqueada"])
        self.assertEqual(r["pedidas"], 1)

    def test_otros_codigos_http_como_404_no_cuentan_como_bloqueo(self):
        items = [aviso(1), aviso(2)]
        pedir = Pedidos(errores={"https://t.test/p1.html": http("https://t.test/p1.html", 404)})
        r = completar(tienda(), items, {}, pedir)
        self.assertEqual(len(pedir.urls), 2)
        self.assertFalse(r["bloqueada"])

    def test_hay_una_pausa_despues_de_cada_pedido(self):
        dormir = mock.Mock()
        completar(tienda(), [aviso(1), aviso(2), aviso(3)], {}, Pedidos(), dormir=dormir)
        self.assertEqual(dormir.call_args_list, [mock.call(indexar.PAUSA_FICHA)] * 3)

    def test_la_poda_saca_lo_que_ya_no_se_publica_y_es_viejo_pero_no_lo_reciente_ni_lo_de_otra_tienda(self):
        cache = {"https://t.test/vieja.html": {"mpn": "AAA111X", "dia": "2026-07-01"},
                 "https://t.test/reciente.html": {"mpn": "BBB222X", "dia": "2026-10-10"},
                 "https://otra.test/x.html": {"mpn": "CCC333X", "dia": "2026-01-01"}}
        completar(tienda(), [aviso(1)], cache, Pedidos())
        self.assertNotIn("https://t.test/vieja.html", cache)
        self.assertIn("https://t.test/reciente.html", cache)
        self.assertIn("https://otra.test/x.html", cache)


class CacheEnDisco(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)

    def test_ida_y_vuelta(self):
        cache = {"https://t.test/b.html": {"mpn": None, "dia": "2026-10-15"},
                 "https://t.test/a.html": {"mpn": "SA400S37/480G", "dia": "2026-10-15"}}
        indexar.escribir_fichas(self.dir / "nueva" / "carpeta", cache)
        self.assertEqual(indexar.leer_fichas(self.dir / "nueva" / "carpeta"), cache)

    def test_sin_archivo_o_con_el_archivo_roto_arranca_vacia(self):
        self.assertEqual(indexar.leer_fichas(self.dir / "no-existe"), {})
        (self.dir / "fichas.json").write_text("{roto", encoding="utf-8")
        self.assertEqual(indexar.leer_fichas(self.dir), {})

    def test_no_reescribe_si_no_cambio(self):
        cache = {"https://t.test/a.html": {"mpn": "AAA111X", "dia": "2026-10-15"}}
        indexar.escribir_fichas(self.dir, cache)
        with mock.patch.object(Path, "write_text") as escribir:
            indexar.escribir_fichas(self.dir, cache)
        escribir.assert_not_called()


class CorridaConFichas(unittest.TestCase):
    """indexar.main() entero: el part number de la ficha llega a la columna `modelo` del indice."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.hist = self.dir / "historial"
        uno = {"nombre": "Uno", "color": "cg", "activa": True, "base": "https://uno.test",
               "catalogo": {"tipo": "json", "url": "https://uno.test/cat", "ruta": "p/{slug}_{id}",
                            "campos": {"id": "id", "nombre": "nombre", "precio": "precio", "lista": "lista"}},
               "ficha": {"extractor": "venex", "rubros": ["ssd"], "tope": 40}}
        (self.dir / "tiendas.json").write_text(json.dumps({"_nota": "x", "uno": uno}), encoding="utf-8")
        for nombre, archivo in (("TIENDAS", "tiendas.json"), ("INDICE", "indice.json"), ("SALUD", "salud.json")):
            p = mock.patch.object(indexar, nombre, self.dir / archivo)
            p.start()
            self.addCleanup(p.stop)
        self.pedidos = []
        for nombre, valor in (("bajar", self.bajar), ("PAUSA_FICHA", 0)):
            p = mock.patch.object(indexar, nombre, valor)
            p.start()
            self.addCleanup(p.stop)

    def bajar(self, u):
        if u == "https://uno.test/cat":
            return json.dumps([{"id": 1, "nombre": SSD, "precio": 50000}, {"id": 2, "nombre": "Mouse Logitech G203", "precio": 9000}])
        self.pedidos.append(u)
        return FICHA

    def correr(self):
        with redirect_stdout(io.StringIO()) as salida:
            self.assertEqual(indexar.main(["--historial", str(self.hist)]), 0)
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        return indice, salida.getvalue()

    def test_el_codigo_de_la_ficha_llega_al_indice_y_la_segunda_corrida_no_pide_nada(self):
        indice, salida = self.correr()
        por_nombre = {f[0]: f for f in indice["productos"]}
        self.assertEqual(por_nombre[SSD][9], "SA400S37/480G")
        self.assertEqual(por_nombre["Mouse Logitech G203"][9], "")
        self.assertEqual(len(self.pedidos), 1)                               # solo el SSD: el mouse no es del rubro
        self.assertIn("1 pedidas", salida)
        guardada = json.loads((self.hist / "fichas.json").read_text(encoding="utf-8"))
        self.assertEqual([e["mpn"] for e in guardada.values()], ["SA400S37/480G"])
        indice, _ = self.correr()
        self.assertEqual(len(self.pedidos), 1)                               # todo salio de la cache
        self.assertEqual({f[0]: f for f in indice["productos"]}[SSD][9], "SA400S37/480G")

    def test_la_cache_vive_en_la_carpeta_del_historial_y_no_se_confunde_con_un_csv(self):
        import historial
        self.correr()
        self.assertTrue((self.hist / "fichas.json").exists())
        self.assertEqual([r.name for r in historial.archivos(self.hist)], [p.name for p in self.hist.glob("*.csv")])

    def test_sin_fichas_configuradas_no_aparece_el_archivo(self):
        cfg = json.loads((self.dir / "tiendas.json").read_text(encoding="utf-8"))
        del cfg["uno"]["ficha"]
        (self.dir / "tiendas.json").write_text(json.dumps(cfg), encoding="utf-8")
        self.correr()
        self.assertFalse((self.hist / "fichas.json").exists())
        self.assertEqual(self.pedidos, [])

if __name__ == "__main__":
    unittest.main()
