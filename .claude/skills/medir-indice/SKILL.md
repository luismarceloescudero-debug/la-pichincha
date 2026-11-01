---
name: medir-indice
description: Mide las reglas de La Pichincha (pestaña Ofertas, repetidas, lotes, «Otros», premium por categoria, titulos y categorias) contra el indice.json publicado y compara el codigo actual con main. Usar antes de abrir un PR que toque js/ofertas.js, js/categorias.js, js/titulo.js o js/premium.js, al revisar una auditoria o cuando el dueño pregunte cuantas ofertas, repetidas o premium hay.
argument-hint: "[--base <rama>] [--indice <ruta>] [--todo]"
---

# Medir las reglas contra el indice real

Las reglas de ofertas y titulos se prueban con tests, pero el numero que importa sale del indice publicado
(31.000 avisos). Este script lo baja y lo mide de una, sin reescribirlo en cada sesion (048, 056 y 058 lo armaron a mano).

## Correrlo

Desde la raiz del repo o del worktree con el cambio:

```bash
node .claude/skills/medir-indice/medir.js            # indice publicado, compara contra main
node .claude/skills/medir-indice/medir.js --base HEAD~1
node .claude/skills/medir-indice/medir.js --indice ruta/indice.json --ofertas ruta/ofertas.json
node .claude/skills/medir-indice/medir.js --todo     # ademas, todos los titulos de la pestaña y todos los cambios
```

Tarda menos de un minuto (baja ~9,5 MB). No escribe nada en el repo: la copia de `js/` de la base va a la carpeta temporal.

## Que muestra

1. **Pestaña Ofertas**: cantidad, por tipo (propia, seguimiento, publicada), por categoria y por tienda.
2. **Repetidas** por ficha o familia (tiene que dar 0, spec 056) y **grupos de 4+** con el mismo % en la misma tienda
   (pista de cambio de lista, spec 047).
3. **«Otros»**: cada aviso que cae ahi (solo tecnologia que no entra en otra categoria, spec 056).
4. **Precios de 9 cifras** (relleno tipo $999.999.999 de OnCity).
5. **Premium por categoria** en todo el indice (referencia: alrededor del 25 % o menos, spec 020/056).
6. **ofertas.json** publicado (lo que va a Telegram) por tienda.
7. **Contra la base**: cuantos titulos y categorias cambia el codigo nuevo (con ejemplos) y cuantos avisos entran
   o salen de la pestaña.

## Como reportarlo

- Copiar los numeros al informe o al PR con la fecha del indice (`indice <fecha>` de la primera linea).
- Un cambio de reglas tiene que mostrar el efecto esperado y nada mas: si cambian 600 titulos y se esperaban 60,
  mirar los ejemplos antes de abrir el PR.
- Trampas conocidas: el indice publicado es el de la ultima corrida (puede tener horas); la pestaña del sitio filtra
  ademas por lo que el navegador ya vio, asi que en el panel puede verse distinto.
