"""Spec 067: relevo desde la PC. La PC lee las tiendas que bloquean al runner, lo deja en la rama `historial` y
indexar.py lo usa solo si su relevo directo falla y el de la PC tiene menos de 36 h."""
import io
import json
import shutil
import subprocess
import tempfile
import unittest
import urllib.error
from contextlib import redirect_stdout
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

import estado_tiendas as et
import indexar
import relevo_pc

RAIZ = Path(__file__).resolve().parent.parent


def producto(i, precio=1000):
    return {"nombre": f"Producto {i}", "precio": precio, "url": f"https://pc.test/prod/{i}", "imagen": "",
            "lista": 0, "sellos": ""}


class Archivo(unittest.TestCase):
    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.ahora = datetime.now(indexar.AR)

    def guardar(self, horas_atras, productos=None):
        datos = relevo_pc.armar("pc", "Pc", productos or [producto(2), producto(1)],
                                self.ahora - timedelta(hours=horas_atras))
        return relevo_pc.escribir(self.dir, datos)

    def test_tiendas_marcadas_en_tiendas_json(self):
        fuentes = json.loads((RAIZ / "tiendas.json").read_text(encoding="utf-8"))
        self.assertEqual(relevo_pc.tiendas_con_relevo(fuentes), ["fullh4rd", "katech"])

    def test_inactiva_no_se_releva(self):
        self.assertEqual(relevo_pc.tiendas_con_relevo({"a": {"relevo": "pc", "activa": False}, "b": {"relevo": "pc"},
                                                       "_nota": "x"}), ["b"])

    def test_escribe_un_producto_por_linea_con_fecha_y_conteo(self):
        ruta = self.guardar(0)
        self.assertEqual(ruta, self.dir / "relevo-pc" / "pc.json")
        texto = ruta.read_text(encoding="utf-8")
        self.assertEqual(len(texto.splitlines()), 4, "cabeza + 2 productos + cierre")
        datos = json.loads(texto)
        self.assertEqual(datos["cantidad"], 2)
        self.assertEqual(datos["via"], "pc")
        self.assertEqual([p["url"] for p in datos["productos"]], ["https://pc.test/prod/1", "https://pc.test/prod/2"])
        self.assertTrue(datos["relevado"].endswith("-03:00"))

    def test_vigente_hasta_36_horas(self):
        self.guardar(35)
        self.assertEqual(relevo_pc.leer_vigente(self.dir, "pc", self.ahora)["cantidad"], 2)
        self.guardar(37)
        self.assertIsNone(relevo_pc.leer_vigente(self.dir, "pc", self.ahora))

    def test_sin_archivo_roto_o_del_futuro_no_sirve(self):
        self.assertIsNone(relevo_pc.leer_vigente(self.dir, "pc", self.ahora))
        (self.dir / "relevo-pc").mkdir()
        (self.dir / "relevo-pc" / "pc.json").write_text("{roto", encoding="utf-8")
        self.assertIsNone(relevo_pc.leer_vigente(self.dir, "pc", self.ahora))
        self.guardar(-5)
        self.assertIsNone(relevo_pc.leer_vigente(self.dir, "pc", self.ahora))

    def test_descarta_filas_que_no_pasarian(self):
        malas = [dict(producto(3), url="javascript:alert(1)"), dict(producto(4), precio=0), dict(producto(5), nombre="")]
        self.guardar(1, [producto(1)] + malas)
        self.assertEqual([p["url"] for p in relevo_pc.leer_vigente(self.dir, "pc", self.ahora)["productos"]],
                         ["https://pc.test/prod/1"])
        self.guardar(1, malas)
        self.assertIsNone(relevo_pc.leer_vigente(self.dir, "pc", self.ahora), "sin filas validas no hay relevo")

    def test_relevar_usa_el_extractor_comun_y_salta_la_que_falla(self):
        fuentes = {"a": {"nombre": "A"}, "b": {"nombre": "B"}, "c": {"nombre": "C"}}

        def leer(fuente, max_paginas):
            if fuente["nombre"] == "B":
                raise urllib.error.HTTPError("u", 403, "Forbidden", {}, None)
            return [] if fuente["nombre"] == "C" else [producto(1)]
        with redirect_stdout(io.StringIO()):
            r = relevo_pc.relevar(fuentes, ["a", "b", "c"], 2, leer_catalogo=leer, ahora=self.ahora)
        self.assertEqual(list(r), ["a"])
        self.assertEqual(r["a"]["cantidad"], 1)

    def test_main_usa_indexar_leer_catalogo(self):
        llamadas = []
        with mock.patch.object(indexar, "leer_catalogo", lambda f, m: llamadas.append(f["nombre"]) or [producto(1)]), \
                redirect_stdout(io.StringIO()):
            self.assertEqual(relevo_pc.main(["--salida", str(self.dir)]), 0)
        self.assertEqual(llamadas, ["FullH4rd", "Katech"])
        self.assertTrue((self.dir / "relevo-pc" / "katech.json").exists())

    def test_reciente(self):
        self.assertFalse(relevo_pc.reciente(self.dir, ["pc"], self.ahora, 12))
        self.guardar(3)
        self.assertTrue(relevo_pc.reciente(self.dir, ["pc"], self.ahora, 12))
        self.assertFalse(relevo_pc.reciente(self.dir, ["pc", "otra"], self.ahora, 12))
        self.guardar(13)
        self.assertFalse(relevo_pc.reciente(self.dir, ["pc"], self.ahora, 12))


def g(*args, cwd):
    return subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


@unittest.skipUnless(shutil.which("git"), "sin git")
class Publicar(unittest.TestCase):
    """Contra un repo bare local con la rama `historial`: clon superficial, commit y push sin --force."""

    def setUp(self):
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir, True)
        self.remoto = self.dir / "remoto.git"
        g("init", "--bare", "-q", str(self.remoto), cwd=self.dir)
        semilla = self.dir / "semilla"
        g("init", "-q", "-b", "historial", str(semilla), cwd=self.dir)
        (semilla / "2026-11.csv").write_text("fecha,tienda,id,precio\n", encoding="utf-8")
        self.identidad = ["-c", "user.name=t", "-c", "user.email=t@t"]
        g("add", "-A", cwd=semilla)
        g(*self.identidad, "commit", "-qm", "inicio", cwd=semilla)
        g("push", "-q", str(self.remoto), "historial", cwd=semilla)
        self.semilla = semilla
        self.trabajo = self.dir / "trabajo"
        self.ahora = datetime.now(indexar.AR)

    def relevos(self, n):
        return {"pc": relevo_pc.armar("pc", "Pc", [producto(i) for i in range(n)], self.ahora)}

    def test_publica_en_la_rama_historial(self):
        commit = relevo_pc.publicar(self.trabajo, self.relevos(3), str(self.remoto), autor=("t", "t@t"),
                                    fecha="2026-11-18")
        self.assertTrue(commit)
        self.assertEqual(g("rev-parse", "historial", cwd=self.remoto), commit)
        self.assertIn("Relevo desde la PC del 2026-11-18: pc 3", g("log", "-1", "--format=%s", "historial",
                                                                    cwd=self.remoto))
        datos = json.loads(g("show", "historial:relevo-pc/pc.json", cwd=self.remoto))
        self.assertEqual(datos["cantidad"], 3)

    def test_si_el_runner_empujo_en_el_medio_se_rebasa_sin_force(self):
        relevo_pc.publicar(self.trabajo, self.relevos(1), str(self.remoto), autor=("t", "t@t"))
        # el runner empuja precios a la rama mientras tanto
        g("pull", "-q", str(self.remoto), "historial", cwd=self.semilla)
        (self.semilla / "2026-11.csv").write_text("fecha,tienda,id,precio\n2026-11-18,a,b,1\n", encoding="utf-8")
        g(*self.identidad, "commit", "-qam", "Precios", cwd=self.semilla)
        g("push", "-q", str(self.remoto), "HEAD:historial", cwd=self.semilla)
        self.ahora += timedelta(hours=24)
        commit = relevo_pc.publicar(self.trabajo, self.relevos(2), str(self.remoto), autor=("t", "t@t"))
        self.assertEqual(g("rev-parse", "historial", cwd=self.remoto), commit)
        self.assertIn("2026-11-18,a,b,1", g("show", "historial:2026-11.csv", cwd=self.remoto),
                      "el commit del runner sigue ahi")

    def test_push_que_choca_se_reintenta_con_pull_rebase(self):
        relevo_pc.publicar(self.trabajo, self.relevos(1), str(self.remoto), autor=("t", "t@t"))
        real = relevo_pc.git
        estado = {"choco": False}

        def git(*args, **kw):
            if args[:1] == ("push",) and not estado["choco"]:
                estado["choco"] = True        # justo antes del push, el runner empuja
                g("pull", "-q", str(self.remoto), "historial", cwd=self.semilla)
                (self.semilla / "otro.csv").write_text("x\n", encoding="utf-8")
                g("add", "-A", cwd=self.semilla)
                g(*self.identidad, "commit", "-qm", "Precios", cwd=self.semilla)
                g("push", "-q", str(self.remoto), "HEAD:historial", cwd=self.semilla)
            return real(*args, **kw)
        self.ahora += timedelta(hours=1)
        with mock.patch.object(relevo_pc, "git", git):
            commit = relevo_pc.publicar(self.trabajo, self.relevos(2), str(self.remoto), autor=("t", "t@t"))
        self.assertTrue(estado["choco"])
        self.assertEqual(g("rev-parse", "historial", cwd=self.remoto), commit)
        self.assertEqual(g("show", "historial:otro.csv", cwd=self.remoto), "x")


def fuente(clave, relevo=False):
    f = {"nombre": clave.capitalize(), "color": "cg", "activa": True, "base": f"https://{clave}.test",
         "catalogo": {"tipo": "json", "url": f"https://{clave}.test/cat", "ruta": "p/{slug}_{id}",
                      "campos": {"id": "id", "nombre": "nombre", "precio": "precio", "lista": "lista"}}}
    if relevo:
        f["relevo"] = "pc"
    return f


class Corrida(unittest.TestCase):
    """indexar.main() con una tienda bloqueada en el runner y un relevo de la PC en la carpeta del historial."""

    def setUp(self):
        parche = mock.patch.object(indexar, "ESPERA_REINTENTO", 0)
        parche.start()
        self.addCleanup(parche.stop)
        self.dir = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.dir)
        self.hist = self.dir / "historial"
        (self.dir / "tiendas.json").write_text(json.dumps({"uno": fuente("uno"), "pc": fuente("pc", relevo=True)}),
                                               encoding="utf-8")
        for nombre, archivo in (("TIENDAS", "tiendas.json"), ("INDICE", "indice.json"), ("SALUD", "salud.json")):
            p = mock.patch.object(indexar, nombre, self.dir / archivo)
            p.start()
            self.addCleanup(p.stop)
        p = mock.patch.object(indexar, "bajar", self.bajar)
        p.start()
        self.addCleanup(p.stop)
        self.bloqueada = True
        self.ahora = datetime.now(indexar.AR)

    def bajar(self, u):
        if u.startswith("https://pc.test") and self.bloqueada:
            raise urllib.error.HTTPError(u, 403, "Forbidden", {}, None)
        if u.endswith("/cat"):
            base = 1 if "uno" in u else 101
            return json.dumps([{"id": base + i, "nombre": f"Producto {base + i}", "precio": 1000} for i in range(2)])
        return "<html>portada</html>"

    def relevo(self, horas_atras, n=3):
        datos = relevo_pc.armar("pc", "Pc", [producto(i, 2000 + i) for i in range(n)],
                                self.ahora - timedelta(hours=horas_atras))
        relevo_pc.escribir(self.hist, datos)
        return datos["relevado"]

    def correr(self):
        with redirect_stdout(io.StringIO()):
            self.assertEqual(indexar.main(["--historial", str(self.hist)]), 0)
        indice = json.loads((self.dir / "indice.json").read_text(encoding="utf-8"))
        salud = json.loads((self.dir / "salud.json").read_text(encoding="utf-8"))
        return indice, salud

    def filas(self, indice, clave):
        return [f for f in indice["productos"] if f[3] == clave]

    def test_bloqueada_con_relevo_fresco_publica_con_su_fecha(self):
        cuando = self.relevo(0.5)
        indice, salud = self.correr()
        self.assertEqual(len(self.filas(indice, "pc")), 3)
        self.assertEqual(indice["tiendas"]["pc"]["relevado"], cuando, "con la hora real del relevo de la PC")
        self.assertNotEqual(indice["tiendas"]["uno"]["relevado"], cuando)
        f = salud["fuentes"]["pc"]
        self.assertEqual((f["estado"], f["via"], f["motivo"]), ("ok", "pc", "relevo pc"))
        self.assertIn("bloqueo", f["detalle"])
        self.assertEqual(salud["tiendas"]["pc"]["estado"], et.ACTIVA)
        estado = json.loads((self.hist / et.ARCHIVO).read_text(encoding="utf-8"))["tiendas"]["pc"]
        self.assertEqual(estado["ultima"], et.OK, "servida por relevo fresco cuenta como OK")

    def test_relevo_de_hoy_se_anota_en_el_historial(self):
        if self.ahora.hour == 0:
            self.skipTest("a medianoche el relevo de hace media hora es de ayer")
        self.relevo(0.5)
        self.correr()
        csv = (self.hist / (self.ahora.date().isoformat()[:7] + ".csv")).read_text(encoding="utf-8")
        self.assertIn("pc,https://pc.test/prod/0,2000", csv)

    def test_relevo_de_ayer_se_publica_pero_no_entra_al_historial(self):
        self.relevo(30)
        indice, salud = self.correr()
        self.assertEqual(len(self.filas(indice, "pc")), 3)
        csv = (self.hist / (self.ahora.date().isoformat()[:7] + ".csv")).read_text(encoding="utf-8")
        self.assertNotIn("pc.test", csv, "un precio de ayer no se anota como de hoy")

    def test_relevo_viejo_no_se_publica(self):
        self.relevo(40)
        indice, salud = self.correr()
        self.assertEqual(self.filas(indice, "pc"), [])
        self.assertEqual(salud["fuentes"]["pc"]["estado"], "fallo")
        self.assertNotIn("via", salud["fuentes"]["pc"])
        estado = json.loads((self.hist / et.ARCHIVO).read_text(encoding="utf-8"))["tiendas"]["pc"]
        self.assertEqual(estado["ultima"], et.BLOQUEO)

    def test_si_el_runner_puede_leer_no_usa_el_relevo(self):
        self.bloqueada = False
        self.relevo(0.5)
        indice, salud = self.correr()
        self.assertEqual({f[0] for f in self.filas(indice, "pc")}, {"Producto 101", "Producto 102"})
        self.assertNotIn("via", salud["fuentes"]["pc"])

    def test_tienda_sin_marca_no_mira_el_relevo(self):
        datos = relevo_pc.armar("uno", "Uno", [producto(9)], self.ahora)
        relevo_pc.escribir(self.hist, datos)
        indice, _ = self.correr()
        self.assertNotIn("Producto 9", {f[0] for f in indice["productos"]})


if __name__ == "__main__":
    unittest.main()
