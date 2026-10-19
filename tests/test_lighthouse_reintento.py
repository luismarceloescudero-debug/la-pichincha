"""Reintento del job lighthouse (19/10/2026): Chrome a veces no arranca en el runner ("waiting for dynamic debugging port
in chrome-err.log") y el job cortaba la CI, con lo que construir y publicar quedaban salteados. Se reintenta SOLO ese
error; cualquier otra falla (un puntaje bajo, un error de Lighthouse) corta de inmediato."""

import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SCRIPT = RAIZ / ".github" / "lighthouse-corrida.sh"
BASH = shutil.which("bash")


@unittest.skipUnless(BASH, "hace falta bash")
class Reintento(unittest.TestCase):
    def correr(self, comportamiento):
        """`comportamiento`: una salida por intento, cada una (codigo, texto de stderr). Devuelve (codigo, intentos hechos)."""
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            falso = d / "falso.sh"
            lineas = ["n=$(cat cuenta 2>/dev/null || echo 0); n=$((n+1)); echo $n > cuenta", 'case $n in']
            for i, (codigo, texto) in enumerate(comportamiento, 1):
                lineas.append(f"{i}) echo '{texto}' >&2; exit {codigo};;")
            lineas.append("*) exit 0;; esac")
            falso.write_text("\n".join(lineas), encoding="utf-8", newline="\n")
            r = subprocess.run([BASH, str(SCRIPT), BASH, str(falso)], cwd=d, capture_output=True, text=True,
                               env={**os.environ, "LH_ESPERA": "0", "LH_INTENTOS": "3"})
            hechos = int((d / "cuenta").read_text().strip())
            return r.returncode, hechos

    def test_reintenta_cuando_chrome_no_arranca_y_termina_bien(self):
        codigo, hechos = self.correr([(1, "Error: waiting for dynamic debugging port in chrome-err.log"), (0, "")])
        self.assertEqual((codigo, hechos), (0, 2))

    def test_si_chrome_nunca_arranca_falla_despues_de_los_intentos(self):
        err = "Error: waiting for dynamic debugging port in chrome-err.log"
        codigo, hechos = self.correr([(1, err)] * 5)
        self.assertNotEqual(codigo, 0)
        self.assertEqual(hechos, 3)

    def test_otra_falla_corta_sin_reintentar(self):
        codigo, hechos = self.correr([(1, "Error: PROTOCOL_TIMEOUT"), (0, "")])
        self.assertEqual((codigo, hechos), (1, 1))

    def test_sin_falla_corre_una_vez(self):
        self.assertEqual(self.correr([(0, "")]), (0, 1))

    def test_el_workflow_usa_el_script_y_el_puntaje_sigue_cortando(self):
        yml = (RAIZ / ".github" / "workflows" / "tests.yml").read_text(encoding="utf-8")
        self.assertIn(".github/lighthouse-corrida.sh npx --yes lighthouse@", yml)
        self.assertIn("node .github/lighthouse.js lh-*.json > lighthouse.txt || falla=1", yml)


if __name__ == "__main__":
    unittest.main()
