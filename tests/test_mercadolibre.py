import io
import json
import unittest
import urllib.error
from contextlib import redirect_stdout
from unittest import mock

import indexar
import mercadolibre as ml

SSD = {"id": "MLA68812268", "name": "Ssd Kingston Nv3 1tb Nvme 4.0", "domain_id": "MLA-HARD_DRIVES_AND_SSDS",
       "pictures": [{"url": "https://http2.mlstatic.com/D_NQ_NP_997278-F.jpg"}],
       "attributes": [{"id": "BRAND", "value_name": "Kingston"}, {"id": "PART_NUMBER", "value_name": "SNV3S/1000G"}]}
VENDEDOR = {"price": 329998.99, "original_price": 392855.95, "currency_id": "ARS", "condition": "new",
            "international_delivery_mode": "none"}


class Respuesta(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class Vendedor(unittest.TestCase):
    def test_el_mas_barato_nuevo_en_pesos_y_desde_argentina_con_su_precio_anterior(self):
        otros = [{**VENDEDOR, "price": 300000, "condition": "used"},
                 {**VENDEDOR, "price": 290000, "currency_id": "USD"},
                 {**VENDEDOR, "price": 280000, "international_delivery_mode": "remote"},
                 {**VENDEDOR, "price": 0}, "raro", {**VENDEDOR, "price": 340000, "original_price": None}]
        self.assertEqual(ml.mejor_vendedor(otros + [VENDEDOR]), (329999, 392856))

    def test_sin_precio_anterior_o_uno_que_no_es_mas_alto_no_hay_tachado(self):
        self.assertEqual(ml.mejor_vendedor([{**VENDEDOR, "original_price": None}]), (329999, None))
        self.assertEqual(ml.mejor_vendedor([{**VENDEDOR, "original_price": 329999}]), (329999, None))

    def test_sin_vendedores_validos_no_hay_oferta(self):
        self.assertIsNone(ml.mejor_vendedor([]))
        self.assertIsNone(ml.mejor_vendedor([{**VENDEDOR, "condition": "used"}]))


class Aviso(unittest.TestCase):
    def test_arma_el_aviso_con_la_ficha_la_foto_la_marca_y_el_codigo(self):
        a = ml.aviso(SSD, [VENDEDOR])
        self.assertEqual(a, {"nombre": "Ssd Kingston Nv3 1tb Nvme 4.0", "marca": "Kingston", "precio": 329999,
                             "lista": 392856, "url": "https://www.mercadolibre.com.ar/ssd-kingston-nv3-1tb-nvme-40/p/MLA68812268",
                             "imagen": "https://http2.mlstatic.com/D_NQ_NP_997278-F.jpg", "sellos": "",
                             "sku": "SNV3S/1000G"})

    def test_la_direccion_es_la_de_mercado_libre_y_comparaya_la_reconoce_como_la_misma(self):
        nombre = "Notebook Acer Aspire Lite 15 con AMD Ryzen 7, 32 GB RAM y 512 GB SSD"
        self.assertEqual(ml.slug(nombre), "notebook-acer-aspire-lite-15-con-amd-ryzen-7-32-gb-ram-y-512-gb-ssd")
        self.assertEqual(ml.slug("Monitor 27\" Señal – ñandú"), "monitor-27-senal-nandu")
        self.assertEqual(ml.slug("¡!"), "producto")

    def test_sin_vendedor_sin_numero_valido_o_sin_nombre_no_hay_aviso(self):
        self.assertIsNone(ml.aviso(SSD, []))
        self.assertIsNone(ml.aviso({**SSD, "id": "MLA-1/../x"}, [VENDEDOR]))
        self.assertIsNone(ml.aviso({**SSD, "name": None}, [VENDEDOR]))

    def test_sin_fotos_ni_atributos_entra_igual(self):
        a = ml.aviso({"id": "MLA1", "name": "Mouse"}, [VENDEDOR])
        self.assertEqual((a["imagen"], a["marca"], a["sku"]), ("", None, None))


def api_falsa(paginas, ventas, pedidos=None):
    """Una API con resultados por (q, offset) y los vendedores por producto."""
    def pedir(ruta):
        if pedidos is not None:
            pedidos.append(ruta)
        if ruta.startswith("/products/search?"):
            q = dict(p.split("=", 1) for p in ruta.split("?", 1)[1].split("&"))
            return {"results": paginas.get((q["q"], int(q["offset"])), [])}
        pid = ruta.split("/")[2]
        if pid in ventas and isinstance(ventas[pid], Exception):
            raise ventas[pid]
        return {"results": ventas.get(pid, [])}
    return pedir


TIENDA = {"catalogo": {"tipo": "mercadolibre", "por_rubro": 100,
                       "rubros": [{"q": "ssd", "dominio": "MLA-HARD_DRIVES_AND_SSDS"},
                                  {"q": "monitor", "dominio": "MLA-COMPUTER_MONITORS"}]}}


class Indexar(unittest.TestCase):
    def correr(self, pedir, max_paginas=12, tienda=TIENDA):
        with redirect_stdout(io.StringIO()) as salida:
            items = ml.indexar(tienda, max_paginas, pedir=pedir, hilos=2)
        return items, salida.getvalue()

    def test_recorre_los_rubros_filtra_el_dominio_y_no_repite_productos(self):
        funda = {"id": "MLA9", "name": "Gabinete externo", "domain_id": "MLA-HARD_DRIVES_AND_SSDS_ENCLOSURES"}
        monitor = {"id": "MLA5", "name": "Monitor LG 27", "domain_id": "MLA-COMPUTER_MONITORS"}
        pedir = api_falsa({("ssd", 0): [SSD, funda, SSD], ("monitor", 0): [monitor, {**SSD, "domain_id": "MLA-COMPUTER_MONITORS"}]},
                          {"MLA68812268": [VENDEDOR], "MLA5": [{**VENDEDOR, "price": 500000}], "MLA9": [VENDEDOR]})
        items, salida = self.correr(pedir)
        self.assertEqual([i["nombre"] for i in items], ["Ssd Kingston Nv3 1tb Nvme 4.0", "Monitor LG 27"])
        self.assertIn("ssd: 1 de 1 productos con vendedor", salida)
        self.assertIn("monitor: 1 de 1 productos con vendedor", salida)

    def test_pide_de_a_100_hasta_el_tope_y_corta_si_la_pagina_vuelve_corta(self):
        llenos = [{"id": f"MLA{i}", "name": f"SSD {i}", "domain_id": "MLA-HARD_DRIVES_AND_SSDS"} for i in range(100)]
        pedidos = []
        pedir = api_falsa({("ssd", 0): llenos, ("ssd", 100): llenos[:3]}, {}, pedidos)
        tienda = {"catalogo": {**TIENDA["catalogo"], "por_rubro": 250, "rubros": TIENDA["catalogo"]["rubros"][:1]}}
        self.correr(pedir, tienda=tienda)
        busquedas = [r for r in pedidos if r.startswith("/products/search?")]
        self.assertEqual(len(busquedas), 2)
        self.assertIn("domain_id=MLA-HARD_DRIVES_AND_SSDS", busquedas[0])
        self.assertIn("limit=100&offset=0", busquedas[0])

    def test_si_la_api_no_deja_paginar_mas_hondo_queda_lo_leido_y_otro_error_corta(self):
        llenos = [{"id": f"MLA{i}", "name": f"SSD {i}", "domain_id": "MLA-HARD_DRIVES_AND_SSDS"} for i in range(100)]
        tienda = {"catalogo": {**TIENDA["catalogo"], "por_rubro": 300, "rubros": TIENDA["catalogo"]["rubros"][:1]}}

        def con_tope(codigo):
            base = api_falsa({("ssd", 0): llenos}, {"MLA1": [VENDEDOR]})

            def pedir(ruta):
                if "offset=100" in ruta:
                    raise urllib.error.HTTPError("u", codigo, "x", {}, None)
                return base(ruta)
            return pedir
        items, _ = self.correr(con_tope(400), tienda=tienda)
        self.assertEqual([i["nombre"] for i in items], ["SSD 1"])
        with self.assertRaises(urllib.error.HTTPError):
            self.correr(con_tope(500), tienda=tienda)

    def test_max_paginas_achica_el_recorrido_para_probar(self):
        pedidos = []
        self.correr(api_falsa({}, {}, pedidos), max_paginas=1)
        self.assertIn("limit=50&offset=0", pedidos[0])

    def test_un_producto_que_no_responde_queda_afuera_y_un_bloqueo_corta_la_fuente(self):
        otro = {**SSD, "id": "MLA2", "name": "SSD WD"}
        pedir = api_falsa({("ssd", 0): [SSD, otro]}, {"MLA68812268": urllib.error.URLError("x"), "MLA2": [VENDEDOR]})
        items, _ = self.correr(pedir)
        self.assertEqual([i["nombre"] for i in items], ["SSD WD"])
        bloqueo = api_falsa({("ssd", 0): [SSD]}, {"MLA68812268": RuntimeError("Mercado Libre respondio 429")})
        with self.assertRaises(RuntimeError):
            self.correr(bloqueo)

    def test_sin_pedir_usa_el_token(self):
        with mock.patch.object(ml, "token", return_value="t") as token, \
                mock.patch.object(ml, "pedidor", return_value=api_falsa({}, {})) as pedidor:
            self.correr(None)
        token.assert_called_once()
        pedidor.assert_called_once_with("t")


class Token(unittest.TestCase):
    def test_sin_secretos_no_hay_fuente(self):
        with self.assertRaisesRegex(RuntimeError, "ML_CLIENT_ID"):
            ml.token({})

    def test_pide_el_token_de_aplicacion(self):
        abrir = mock.Mock(return_value=Respuesta(json.dumps({"access_token": "abc"}).encode()))
        self.assertEqual(ml.token({"ML_CLIENT_ID": "1", "ML_CLIENT_SECRET": "s"}, abrir), "abc")
        pedido = abrir.call_args.args[0]
        self.assertEqual(pedido.full_url, "https://api.mercadolibre.com/oauth/token")
        self.assertIn(b"grant_type=client_credentials", pedido.data)

    def test_sin_token_en_la_respuesta_falla(self):
        abrir = mock.Mock(return_value=Respuesta(b"{}"))
        with self.assertRaisesRegex(RuntimeError, "no dio un token"):
            ml.token({"ML_CLIENT_ID": "1", "ML_CLIENT_SECRET": "s"}, abrir)


class Pedidor(unittest.TestCase):
    def test_manda_el_token_y_devuelve_el_json(self):
        abrir = mock.Mock(return_value=Respuesta(b'{"results": []}'))
        self.assertEqual(ml.pedidor("t", abrir)("/products/x"), {"results": []})
        pedido = abrir.call_args.args[0]
        self.assertEqual(pedido.full_url, "https://api.mercadolibre.com/products/x")
        self.assertEqual(pedido.get_header("Authorization"), "Bearer t")

    def test_un_bloqueo_corta_y_otro_error_sigue_siendo_un_error_de_red(self):
        for codigo, error in ((429, RuntimeError), (403, RuntimeError), (404, urllib.error.HTTPError)):
            abrir = mock.Mock(side_effect=urllib.error.HTTPError("u", codigo, "x", {}, None))
            with self.assertRaises(error):
                ml.pedidor("t", abrir)("/products/x")


class SinRepetirAgregador(unittest.TestCase):
    def test_un_producto_de_mercado_libre_por_la_api_saca_la_copia_de_comparaya_aunque_la_direccion_cambie(self):
        directa = ["SSD", 1, "https://www.mercadolibre.com.ar/ssd-kingston/p/MLA68812268", "mercadolibre"]
        copia = ["SSD", 2, "https://www.mercadolibre.com.ar/ssd-kingston-nv3-1tb/p/MLA68812268?pdp=1", "comparaya"]
        otra = ["SSD", 3, "https://www.mercadolibre.com.ar/otro/p/MLA1", "comparaya"]
        self.assertEqual(indexar.sin_repetir_agregador([directa, copia, otra], {"comparaya"}), [directa, otra])
        self.assertEqual(indexar.clave_aviso("https://mercadolibre.com.ar/p/mla5"), "mercadolibre.com.ar/p/MLA5")
        self.assertEqual(indexar.clave_aviso("https://www.otra.test/x/"), "otra.test/x")


if __name__ == "__main__":
    unittest.main()
