---
name: cerrar-pr
description: Cierra un PR de La Pichincha con la regla fija del dueño - espera la CI, mergea con rebase, limpia worktree y ramas y actualiza main.
argument-hint: "<numero de PR>"
disable-model-invocation: true
---

# Cerrar un PR

Regla permanente del dueño (16/10/2026): con **todos** los checks en verde se mergea con rebase sin preguntar.
Si el repo no tuviera CI, solo se mergea un PR que cambia nada mas que documentacion.

PR: `$ARGUMENTS` (si esta vacio, el PR abierto de la rama actual: `gh pr view --json number -q .number`).

## Pasos (en este orden)

1. **Antes**: `git status` limpio salvo lo del PR; nada sin commitear; ningun secreto ni dato privado en el diff
   (`git diff main...HEAD --stat` y mirar `privado/`, `.env`, planillas). Commits sin tildes ni eñes.
2. **Esperar la CI** sin tuberia (con `| cut` el codigo de salida es el del ultimo comando y se puede mergear con
   un check `pending`):
   ```bash
   gh pr checks N --watch
   ```
   Si algun check falla: no mergear. Leer el log (`gh run view <id> --log-failed`), arreglar, pushear y volver a 2.
3. **Mergear**: `gh pr merge N --rebase`.
4. **Limpiar**:
   - salir del worktree si es el directorio activo (ExitWorktree) y mandar su carpeta a la **Papelera**
     (nunca borrado permanente), despues `git worktree prune`;
   - borrar la rama local (`git branch -D <rama>`) y la remota (`git push origin --delete <rama>`, si no se borro sola).
5. **Actualizar**: en la carpeta principal, `git pull --ff-only`. Si ahi hay cambios del dueño sin commitear, no
   tocarlos (ni stash ni checkout): avisar que `main` local quedo atrasado.
6. **Avisar** en una linea: PR mergeado, commit nuevo de `main` y que quedo pendiente.

## Nunca

- `gh workflow run` ni publicar en Telegram o Instagram como parte del cierre (el hook `guardia.py` lo frena).
- Mergear con un check en `pending` o `fail`, ni con `--admin`.
