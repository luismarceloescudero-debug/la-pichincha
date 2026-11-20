---
name: verificar-publicacion
description: Antes de lanzar una corrida manual de actualizar.yml o de mergear algo que publica en La Pichincha, revisa issues a-revisar, la ultima corrida de main, la cache del indice y la edad del indice publicado. Usala siempre antes de publicar.
---

# Verificar antes de publicar

Corta el error de «publicar sin mirar» (regla «Correos antes de publicar» del CLAUDE.md del repo).

## Pasos

1. Correr (solo lee, no publica nada):
   ```bash
   python herramientas/verificar_publicacion.py
   ```
2. Leer la salida:
   - `FRENO`: no publicar. Si es una corrida fallida, diagnosticarla con `python herramientas/ci_diagnostico.py <run_id>`.
     Si es la cache sin indice, es el error E01: la corrida manual con `indexar=true` lo rearma (decision del dueño).
   - `AVISO`: leer el motivo. Con issues `a-revisar`, abrirlos y decidir si apuntan a un error del codigo (se arregla
     primero) o a ruido conocido (se anota con su E-xx).
   - Todo `OK`: se puede seguir.
3. Despues de publicar, volver a correrlo: el indice publicado tiene que estar fresco y la ultima corrida en verde.

## Nunca

- Lanzar `gh workflow run` si hay un `FRENO` sin entenderlo.
- Mirar solo el verde de los tests: la publicacion es otro workflow.
