"""Los workflows no pueden tener una clave repetida en un mismo mapa YAML (F0, docs/plan-definitivo.md).

El 13/11 un `continue-on-error` repetido en un paso de actualizar.yml dejo el workflow invalido: GitHub no lo corria y
fallaron 4 publicaciones sin que ningun test lo marcara. La CI corre ademas actionlint (tests.yml), que tambien lo
detecta; este test lo cubre sin herramientas externas (biblioteca estandar, constitucion I).

No es un parser YAML completo: sigue la indentacion de los mapas en bloque, los items de lista (`- clave:`) y saltea
el contenido de los escalares en bloque (`run: |`, `run: >`). Alcanza para los workflows de este repo.
"""
import re
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
WORKFLOWS = sorted((RAIZ / ".github" / "workflows").glob("*.yml"))

CLAVE = re.compile(r"""^("[^"]*"|'[^']*'|[^\s#'"{\[][^:#]*?)\s*:(?:\s|$)(.*)$""")


def claves_repetidas(texto):
    """Devuelve [(linea, clave)] de cada clave que ya estaba en el mismo mapa."""
    repetidas = []
    pila = []  # [(indentacion del mapa, claves vistas)]
    bloque = None  # indentacion de la clave dueña de un escalar en bloque
    for n, linea in enumerate(texto.splitlines(), 1):
        contenido = linea.strip()
        sangria = len(linea) - len(linea.lstrip(" "))
        if bloque is not None:
            if not contenido or sangria > bloque:
                continue
            bloque = None
        if not contenido or contenido.startswith("#"):
            continue
        resto = linea[sangria:]
        while resto.startswith("- "):
            # Un item de lista: cierra los mapas del item anterior y abre uno nuevo dos espacios adentro.
            while pila and pila[-1][0] > sangria:
                pila.pop()
            sangria += 2
            resto = resto[2:]
            pila.append((sangria, set()))
        m = CLAVE.match(resto)
        if not m:
            continue
        clave, valor = m.group(1).strip("'\""), m.group(2).strip()
        while pila and pila[-1][0] > sangria:
            pila.pop()
        if not pila or pila[-1][0] < sangria:
            pila.append((sangria, set()))
        vistas = pila[-1][1]
        if clave in vistas:
            repetidas.append((n, clave))
        vistas.add(clave)
        if re.match(r"^[|>][-+0-9]*(\s+#.*)?$", valor):
            bloque = sangria
    return repetidas


class ClavesRepetidas(unittest.TestCase):
    def test_hay_workflows(self):
        self.assertGreaterEqual(len(WORKFLOWS), 6)

    def test_ningun_workflow_repite_una_clave(self):
        for ruta in WORKFLOWS:
            with self.subTest(workflow=ruta.name):
                self.assertEqual(claves_repetidas(ruta.read_text(encoding="utf-8")), [])

    def test_las_acciones_van_fijadas_por_sha_con_la_version_en_comentario(self):
        # B3 (auditoria 11/11): una etiqueta movil (@v7) puede cambiar de codigo sin que el repo se entere
        fijada = re.compile(r"^[\w.-]+/[\w./-]+@[0-9a-f]{40} # v\d[\w.]*$")
        for ruta in WORKFLOWS:
            for n, linea in enumerate(ruta.read_text(encoding="utf-8").splitlines(), 1):
                m = re.match(r"^\s*(?:- )?uses:\s*(.+?)\s*$", linea)
                if m and not m.group(1).startswith("./"):
                    with self.subTest(workflow=ruta.name, linea=n):
                        self.assertRegex(m.group(1), fijada)

    def test_detecta_el_continue_on_error_repetido_del_13_11(self):
        texto = (
            "jobs:\n"
            "  armar:\n"
            "    steps:\n"
            "      - name: Commitear\n"
            "        continue-on-error: true\n"
            "        run: |\n"
            "          continue-on-error: esto es texto del script\n"
            "        continue-on-error: true\n"
            "      - name: Otro\n"
            "        continue-on-error: true\n"
        )
        self.assertEqual(claves_repetidas(texto), [(8, "continue-on-error")])

    def test_la_misma_clave_en_mapas_distintos_no_es_repetida(self):
        texto = (
            "jobs:\n"
            "  a:\n"
            "    runs-on: ubuntu-latest\n"
            "    steps:\n"
            "      - name: Uno\n"
            "        with:\n"
            "          name: x\n"
            "      - name: Dos\n"
            "  b:\n"
            "    runs-on: ubuntu-latest\n"
        )
        self.assertEqual(claves_repetidas(texto), [])

    def test_detecta_jobs_repetidos(self):
        self.assertEqual(claves_repetidas("jobs:\n  a:\n    x: 1\n  a:\n    x: 2\n"), [(4, "a")])


class CacheDelIndice(unittest.TestCase):
    """19/11: D1 y D2 cambiaron indexar.py, la clave de la cache cambio de hash y el push siguiente no
    encontro indice (D4 lo freno). El restore-key sin hash evita que un cambio del indexador deje sin
    publicar los pushes hasta la proxima corrida programada."""

    def test_la_cache_del_indice_cae_a_cualquier_version(self):
        texto = (RAIZ / ".github" / "workflows" / "actualizar.yml").read_text(encoding="utf-8")
        m = re.search(r"name: Recuperar el indice anterior\s.*?restore-keys:\s*\|?\s*\n((?:\s+indice-.*\n)+)", texto, re.S)
        self.assertIsNotNone(m, "no encuentro los restore-keys del indice")
        claves = [c.strip() for c in m.group(1).splitlines() if c.strip()]
        self.assertIn("indice-", claves)
        self.assertGreaterEqual(len(claves), 2)


if __name__ == "__main__":
    unittest.main()
