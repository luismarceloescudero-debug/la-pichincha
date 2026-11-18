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
    def test_dns_que_no_resuelve(self):
        e = urllib.error.URLError(socket.gaierror(-2, "Name or service not known"))
        self.assertTrue(et.es_muerta(e))

    def test_certificado_invalido(self):
        e = urllib.error.URLError(ssl.SSLCertVerificationError(1, "certificate verify failed"))
        self.assertTrue(et.es_muerta(e))

    def test_conexion_rechazada_o_sin_respuesta_al_conectar(self):
        self.assertTrue(et.es_muerta(urllib.error.URLError(ConnectionRefusedError(111, "refused"))))
        self.assertTrue(et.es_muerta(urllib.error.URLError(TimeoutError("timed out"))))

    def test_origen_caido_detras_de_cloudflare(self):
        for codigo in (521, 522, 523, 530):
            self.assertTrue(et.es_muerta(urllib.error.HTTPError("https://x.test", codigo, "x", {}, None)), codigo)

    def test_envuelto_por_un_lector(self):
        try:
            try:
                raise urllib.error.URLError(socket.gaierror(-2, "x"))
            except urllib.error.URLError as e:
                raise RuntimeError("no se pudo leer") from e
        except RuntimeError as e:
            self.assertTrue(et.es_muerta(e))

    def test_lo_que_no_es_muerte(self):
        self.assertFalse(et.es_muerta(urllib.error.HTTPError("https://x.test", 403, "x", {}, None)))
        self.assertFalse(et.es_muerta(urllib.error.HTTPError("https://x.test", 404, "x", {}, None)))
        self.assertFalse(et.es_muerta(TimeoutError("lectura lenta")))     # contesto y se corto: es la red
        self.assertFalse(et.es_muerta(OSError("sin conexion")))
        self.assertFalse(et.es_muerta(None))

    def test_sondear(self):
        def caida(url):
            raise urllib.error.URLError(socket.gaierror(-2, "x"))

        def bloquea(url):
            raise urllib.error.HTTPError(url, 403, "x", {}, None)

        self.assertTrue(et.sondear(caida, "https://x.test"))
        self.assertFalse(et.sondear(bloquea, "https://x.test"), "un 403 es una tienda viva que no nos quiere")
        self.assertFalse(et.sondear(lambda u: "<html>", "https://x.test"))
        self.assertFalse(et.sondear(caida, ""), "sin base no se sondea")


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

    def test_una_tienda_sin_productos_hace_mas_de_catorce_dias_entra_en_pausa_en_la_primera_corrida(self):
        estados = et.sembrar(["k"], {}, inicio=dia(-31), hoy=HOY)
        reg, cambio = et.observar(estados["k"], et.BLOQUEO, HOY)
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

    def test_no_es_un_csv_del_historial(self):
        import historial
        et.escribir(self.dir, {"a": et.registro_nuevo()}, HOY)
        self.assertEqual(historial.archivos(self.dir), [])


if __name__ == "__main__":
    unittest.main()
