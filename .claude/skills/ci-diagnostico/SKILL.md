---
name: ci-diagnostico
description: Diagnostica una corrida fallida de GitHub Actions de La Pichincha contra los errores conocidos (docs/errores-conocidos.md). Dice que paso fallo, si es un error ya conocido (E##) o nuevo, y si es intermitente. Usala al ver un FRENO de verificar-publicacion o una corrida roja de actualizar.yml.
---

# Diagnosticar una corrida fallida

Corta el error de «arreglar a ciegas» una corrida roja: primero se clasifica contra los errores conocidos.

## Pasos

1. Correr (solo lee, no publica nada):
   ```bash
   python herramientas/ci_diagnostico.py <run_id>
   ```
   El `run_id` sale de `gh run list` (columna ID) o del aviso de GitHub Actions.
2. Leer la salida:
   - `Conocido E##`: ya esta en `docs/errores-conocidos.md` con su guardia. Mirar esa fila antes de tocar codigo; si la
     guardia fallo, se corrige la guardia, no se pone un parche al lado.
   - `Error NUEVO`: no coincide con nada. Hallar la causa raiz y registrarla con la skill `registrar-error` (fila nueva
     y firma en `FIRMAS`).
   - `Intermitente`: otra corrida del mismo workflow y commit termino en verde, asi que la falla no es del codigo.
3. Si es E01 (cache sin indice), la corrida manual con `indexar=true` lo rearma (decision del dueno); no hace falta tocar
   el indexador.

## Nunca

- Arreglar codigo sin mirar primero si es un error conocido (E##).
- Registrar una firma nueva en `FIRMAS` sin su fila en `docs/errores-conocidos.md`: `tests/test_ci_diagnostico.py` lo exige.
