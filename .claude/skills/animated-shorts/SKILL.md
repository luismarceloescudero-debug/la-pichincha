---
name: animated-shorts
description: Genera una vista animada estilo reel/short (scroll vertical con snap, animaciones de entrada y modo edicion) de una seccion o portada del sitio, para revisar cambios antes de pasarlos a produccion. Usar cuando el dueno pida ver la app "animada", en formato short, o repasar modificaciones de diseño de forma vistosa.
---

# animated-shorts (fabricada propia)

Reemplazo propio de `claude-animated-shorts`, que no existe y ademas seria una skill de terceros
(bloqueada por la regla "Nada de terceros"). Esta hace lo mismo sin traer codigo ajeno.

## Que produce

Una pagina HTML autocontenida, vertical, estilo reel/short:

- scroll-snap vertical: un slide por pantalla, con dots de progreso.
- animaciones de entrada escalonadas (IntersectionObserver + `transition-delay`).
- autoplay con pausa (avanza de slide en slide) que se frena al scrollear a mano.
- modo edicion en vivo: precios, tienda, destacado/evitar, roles de tienda y veredicto,
  con "copiar cambios" que devuelve el diff como JSON.
- paleta y tipografia reales de `css/sitio.css` (IBM Plex Sans + Mono, tokens de color),
  tema claro/oscuro.

## Pasos

1. Leer los datos reales: `datos.json` (tiendas, productos, veredicto, calculado),
   `consultas.json` (busquedas) y los tokens de color de `css/sitio.css`.
2. Escribir el HTML en `privado/vista-animada-<nombre>.html` (no se commitea).
3. Abrirlo local: `Start-Process "<ruta>"`. La herramienta Artifact puede estar bloqueada
   por `ANTHROPIC_AUTH_TOKEN` (LiteLLM/DeepSeek); si es el caso, abrir local y avisar.
4. Si hay login de claude.ai disponible, publicarlo con la herramienta Artifact.

## Invariantes

- Datos reales, nunca lorem ipsum.
- Funciona a 400px de ancho y en desktop; sin scroll horizontal.
- El modo edicion NO escribe `datos.json`: los cambios salen por "copiar cambios" como diff JSON.
- Respetar `prefers-reduced-motion` (desactivar transiciones si esta activo).
- Cada slide es un bloque completo: lo visible se lee sin scrollear.
