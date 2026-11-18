"""Spec 066: alta, pausa y baja automaticas de una tienda segun lo que trae corrida tras corrida."""
import json
import shutil
import socket
import ssl
import tempfile
import unittest
import urllib.error
from datetime import date, timedelta
from pathlib import Path

import estado_tiendas as et

HOY = date(2026, 11, 17)


def dia(n):
    return HOY + timedelta(days=n)


class Clasificar(unittest.TestCase):
    def test_con_productos_es_ok_aunque_haya_un_motivo(self):
        self.assertEqual(et.clasificar(5, "bloqueo", False), et.OK)

    def test_sin_productos(self):
        self.assertEqual(et.clasificar(0, "sin productos", False), et.VACIA)
        self.assertEqual(et.clasificar(0, "error", False), et.VACIA)
        self.assertEqual(et.clasificar(0, "red", False), et.VACIA)

    def test_bloqueo_y_cloudflare(self):
        self.assertEqual(et.clasificar(0, "bloqueo", False), et.BLOQUEO)
        self.assertEqual(et.clasificar(0, "cloudflare", False), et.BLOQUEO)

    def test_muerta_manda_sobre_el_motivo(self):
        self.assertEqual(et.clasificar(0, "red", True), et.MUERTA)


class EsMuerta(unittest.TestCase):
    """Muerta SOLO con NXDOMAIN (el dominio no existe) o con el origen caido detras de Cloudflare (521/522/523/530).
    Un DNS temporal (EAI_AGAIN), un tiempo agotado, una conexion rechazada o un certificado malo son la red: VACIA."""

    def test_dns_que_no_resuelve(self):
        e = urllib.error.URLError(socket.gaierror(socket.EAI_NONAME, "Name or service not known"))
        self.assertTrue(et.es_muerta(e))

    def test_dns_temporal_del_runner_no_es_muerte(self):
        e = urllib.error.URLError(socket.gaierror(socket.EAI_AGAIN, "Temporary failure in name resolution"))
        self.assertFalse(et.es_muerta(e))
        self.assertTrue(et.es_red(e))

    def test_certificado_conexion_y_tiempo_son_la_red(self):
        for causa in (ssl.SSLCertVerificationError(1, "certificate verify failed"),
                      ConnectionRefusedError(111, "refused"), TimeoutError("timed out")):
            e = urllib.error.URLError(causa)
            self.assertFalse(et.es_muerta(e), causa)
            self.assertTrue(et.es_red(e), causa)

    def test_origen_caido_detras_de_cloudflare(self):
        for codigo in (521, 522, 523, 530):
            self.assertTrue(et.es_muerta(urllib.error.HTTPError("https://x.test", codigo, "x", {}, None)), codigo)

    def test_envuelto_por_un_lector(self):
        try:
            try:
                raise urllib.error.URLError(socket.gaierror(socket.EAI_NONAME, "x"))
            except urllib.error.URLError as e:
                raise RuntimeError("no se pudo leer") from e
        except RuntimeError as e:
            self.assertTrue(et.es_muerta(e))

    def test_lo_que_no_es_muerte(self):
        self.assertFalse(et.es_muerta(urllib.error.HTTPError("https://x.test", 403, "x", {}, None)))
        self.assertFalse(et.es_muerta(urllib.error.HTTPError("https://x.test", 404, "x", {}, None)))
        self.assertFalse(et.es_muerta(TimeoutError("lectura lenta")))
        self.assertFalse(et.es_muerta(OSError("sin conexion")))
        self.assertFalse(et.es_muerta(None))

    def test_es_red(self):
        self.assertTrue(et.es_red(OSError("sin conexion")))
        self.assertFalse(et.es_red(urllib.error.HTTPError("https://x.test", 500, "x", {}, None)), "contesto: no es red")
        self.assertFalse(et.es_red(ValueError("json roto")))
        self.assertFalse(et.es_red(None))

    def test_sondear(self):
        def caida(url):
            raise urllib.error.URLError(socket.gaierror(socket.EAI_NONAME, "x"))

        def dns_temporal(url):
            raise urllib.error.URLError(socket.gaierror(socket.EAI_AGAIN, "x"))

        def bloquea(url):
            raise urllib.error.HTTPError(url, 403, "x", {}, None)

        self.assertTrue(et.sondear(caida, "https://x.test"))
        self.assertFalse(et.sondear(dns_temporal, "https://x.test"), "un DNS temporal no confirma la muerte")
        self.assertFalse(et.sondear(bloquea, "https://x.test"), "un 403 es una tienda viva que no nos quiere")
        self.assertFalse(et.sondear(lambda u: "<html>", "https://x.test"))
        self.assertFalse(et.sondear(caida, ""), "sin base no se sondea")

    def test_sondeo_dice_por_que(self):
        def dns_temporal(url):
            raise urllib.error.URLError(socket.gaierror(socket.EAI_AGAIN, "x"))
        self.assertEqual(et.sondeo(dns_temporal, "https://x.test"), et.RED)
        self.assertEqual(et.sondeo(lambda u: "", "https://x.test"), et.VIVA)
        self.assertIsNone(et.sondeo(dns_temporal, ""))


class Freno(unittest.TestCase):
    def test_treinta_por_ciento_caidas_frena(self):
        self.assertTrue(et.frenar(relevadas=10, caidas=3))
        self.assertFalse(et.frenar(relevadas=10, caidas=2))

    def test_pocas_tiendas_no_frenan(self):
        self.assertFalse(et.frenar(relevadas=1, caidas=1), "una corrida --solo no es una caida del runner")
        self.assertFalse(et.frenar(relevadas=0, caidas=0))


class Observar(unittest.TestCase):
    def correr(self, clases, desde=0, reg=None):
        """Aplica una clase por dia y devuelve el registro final y los cambios."""
        reg = reg or et.registro_nuevo()
        cambios = []
        for i, clase in enumerate(clases):
            reg, cambio = et.observar(reg, clase, dia(desde + i))
            if cambio:
                cambios.append((desde + i, cambio["de"], cambio["a"]))
        return reg, cambios

    def test_ok_sigue_activa_sin_cambios(self):
        reg, cambios = self.correr([et.OK] * 5)
        self.assertEqual((reg["estado"], cambios), (et.ACTIVA, []))
        self.assertEqual(reg["ultimo_ok"], dia(4).isoformat())

    def test_muerta_tres_corridas_seguidas_es_baja(self):
        reg, cambios = self.correr([et.MUERTA] * 3)
        self.assertEqual(reg["estado"], et.BAJA)
        self.assertEqual(cambios, [(2, et.ACTIVA, et.BAJA)])

    def test_dos_muertas_y_una_vacia_no_es_baja(self):
        reg, cambios = self.correr([et.MUERTA, et.MUERTA, et.VACIA, et.MUERTA])
        self.assertEqual((reg["estado"], cambios), (et.ACTIVA, []))

    def test_dos_corridas_el_mismo_dia_cuentan_una(self):
        reg = et.registro_nuevo()
        for d in (0, 0, 0, 1):
            reg, _ = et.observar(reg, et.MUERTA, dia(d))
        self.assertEqual((reg["muertas_seguidas"], reg["estado"]), (2, et.ACTIVA))

    def test_vacia_o_bloqueo_catorce_dias_es_pausa(self):
        clases = [et.VACIA, et.BLOQUEO] * 7 + [et.BLOQUEO]          # dias 0..14
        reg, cambios = self.correr(clases)
        self.assertEqual(reg["estado"], et.PAUSA)
        self.assertEqual(cambios, [(et.DIAS_PAUSA, et.ACTIVA, et.PAUSA)], "un solo cambio, el dia 14")

    def test_trece_dias_no_alcanzan(self):
        reg, cambios = self.correr([et.VACIA] * et.DIAS_PAUSA)       # dias 0..13
        self.assertEqual((reg["estado"], cambios), (et.ACTIVA, []))

    def test_un_dia_bueno_corta_la_racha(self):
        reg, cambios = self.correr([et.VACIA] * 10 + [et.OK] + [et.VACIA] * 10)
        self.assertEqual((reg["estado"], cambios), (et.ACTIVA, []))

    def test_vuelve_de_la_pausa_en_la_misma_corrida(self):
        reg, cambios = self.correr([et.BLOQUEO] * 15 + [et.OK])
        self.assertEqual(reg["estado"], et.ACTIVA)
        self.assertEqual(cambios[-1], (15, et.PAUSA, et.ACTIVA))

    def test_vuelve_de_la_baja(self):
        reg, cambios = self.correr([et.MUERTA] * 3 + [et.OK])
        self.assertEqual(cambios, [(2, et.ACTIVA, et.BAJA), (3, et.BAJA, et.ACTIVA)])

    def test_en_baja_sigue_muerta_sin_cambios(self):
        reg, cambios = self.correr([et.MUERTA] * 3)
        reg, cambios = self.correr([et.MUERTA, et.MUERTA], desde=10, reg=reg)
        self.assertEqual((reg["estado"], cambios), (et.BAJA, []))

    def test_el_dominio_revive_sin_productos_pasa_a_pausa(self):
        # Volvio a resolver pero no trae nada: deja de ser baja (se releva a diario otra vez) y sigue sin publicarse.
        reg, _ = self.correr([et.MUERTA] * 3)
        reg, cambios = self.correr([et.VACIA], desde=7, reg=reg)
        self.assertEqual(cambios, [(7, et.BAJA, et.PAUSA)])

    def test_en_pausa_no_hay_cambios_diarios(self):
        reg, cambios = self.correr([et.VACIA] * 30)
        self.assertEqual(len(cambios), 1)


class Ping(unittest.TestCase):
    def test_solo_en_baja_y_una_vez_por_semana(self):
        reg = et.registro_nuevo()
        self.assertFalse(et.toca_ping(reg, HOY), "una tienda activa se releva entera, no se sondea")
        reg["estado"] = et.BAJA
        self.assertTrue(et.toca_ping(reg, HOY), "sin ping registrado, toca")
        reg["ultimo_ping"] = dia(-6).isoformat()
        self.assertFalse(et.toca_ping(reg, HOY))
        reg["ultimo_ping"] = dia(-et.DIAS_PING_BAJA).isoformat()
        self.assertTrue(et.toca_ping(reg, HOY))

    def test_un_ping_con_fecha_rota_toca_y_no_tira_el_indexado(self):
        for roto in ("ayer", 5, ["x"]):
            self.assertTrue(et.toca_ping(dict(et.registro_nuevo(), estado=et.BAJA, ultimo_ping=roto), HOY), roto)


class Defensivo(unittest.TestCase):
    def test_observar_un_registro_roto_no_tira_el_indexado(self):
        for roto in ({"sin_productos_desde": "ayer"}, {"muertas_seguidas": "tres"}, {"estado": None},
                     {"sin_productos_desde": 7}, [1, 2], "x"):
            reg, _ = et.observar(roto, et.MUERTA, HOY)
            self.assertIn(reg["estado"], (et.ACTIVA, et.PAUSA, et.BAJA), roto)
            self.assertEqual(reg["sin_productos_desde"], HOY.isoformat(), roto)
            reg, _ = et.observar(roto, et.OK, HOY)
            self.assertEqual(reg["estado"], et.ACTIVA, roto)


class Semilla(unittest.TestCase):
    def test_sale_del_ultimo_dia_con_productos_o_del_inicio_del_historial(self):
        estados = et.sembrar(["a", "b", "c"], {"a": dia(-3), "b": HOY}, inicio=dia(-40), hoy=HOY)
        self.assertEqual(estados["a"]["sin_productos_desde"], dia(-2).isoformat())
        self.assertEqual(estados["a"]["ultimo_ok"], dia(-3).isoformat())
        self.assertIsNone(estados["b"]["sin_productos_desde"])
        self.assertEqual(estados["c"]["sin_productos_desde"], dia(-40).isoformat(),
                         "nunca trajo nada en todo el historial: sin productos desde que empezo")
        self.assertTrue(all(r["estado"] == et.ACTIVA for r in estados.values()), "la semilla no da de baja a nadie")

    def test_sin_historial_no_inventa_fechas(self):
        estados = et.sembrar(["c"], {}, inicio=None, hoy=HOY)
        self.assertIsNone(estados["c"]["sin_productos_desde"])

    def test_la_corrida_de_siembra_no_pausa_pero_la_siguiente_si(self):
        # Sin indice anterior la semilla puede fechar mal la ultima vez con productos: hace falta una falla real
        # observada despues de sembrar para pasar a pausa.
        estados = et.sembrar(["k"], {}, inicio=dia(-31), hoy=HOY)
        reg, cambio = et.observar(estados["k"], et.BLOQUEO, HOY, puede_pausar=False)
        self.assertEqual((reg["estado"], cambio), (et.ACTIVA, None))
        reg, cambio = et.observar(reg, et.BLOQUEO, dia(1))
        self.assertEqual((reg["estado"], cambio["a"]), (et.PAUSA, et.PAUSA))


class Disco(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)

    def test_sin_archivo_o_roto_es_none(self):
        self.assertIsNone(et.leer(self.dir))
        (self.dir / et.ARCHIVO).write_text("{roto", encoding="utf-8")
        self.assertIsNone(et.leer(self.dir))

    def test_ida_y_vuelta(self):
        estados = {"a": dict(et.registro_nuevo(), estado=et.PAUSA)}
        et.escribir(self.dir, estados, HOY)
        self.assertEqual(et.leer(self.dir), estados)
        datos = json.loads((self.dir / et.ARCHIVO).read_text(encoding="utf-8"))
        self.assertEqual(datos["actualizado"], HOY.isoformat())

    def test_leer_normaliza_y_descarta_los_registros_rotos(self):
        tiendas = {
            "viejo": {"estado": et.PAUSA, "sin_productos_desde": "2026-11-01"},      # le faltan campos: se completan
            "fecha_mala": {"estado": et.ACTIVA, "sin_productos_desde": "ayer"},
            "lista": [1, 2],
            "sin_estado": {"ultimo_ok": "2026-11-01"},
            "estado_raro": {"estado": "zombi"},
            "contador_malo": {"estado": et.ACTIVA, "muertas_seguidas": "tres"},
            "sano": dict(et.registro_nuevo(), ultimo_ok="2026-11-10"),
        }
        (self.dir / et.ARCHIVO).write_text(json.dumps({"tiendas": tiendas}), encoding="utf-8")
        leidos = et.leer(self.dir)
        self.assertEqual(set(leidos), {"viejo", "sano"}, "los rotos se descartan y se re-siembran")
        self.assertEqual(leidos["viejo"], dict(et.registro_nuevo(), estado=et.PAUSA, sin_productos_desde="2026-11-01"))
        self.assertEqual(leidos["sano"]["ultimo_ok"], "2026-11-10")

    def test_no_es_un_csv_del_historial(self):
        import historial
        et.escribir(self.dir, {"a": et.registro_nuevo()}, HOY)
        self.assertEqual(historial.archivos(self.dir), [])


if __name__ == "__main__":
    unittest.main()
