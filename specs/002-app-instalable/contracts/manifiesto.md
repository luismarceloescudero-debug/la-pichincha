# Contrato: `manifest.webmanifest`

```json
{ "name": "La Pichincha", "short_name": "Pichincha", "description": "Comparador de hardware en Argentina",
  "lang": "es-AR", "start_url": "./", "scope": "./", "display": "standalone",
  "background_color": "<fondo claro del sitio>", "theme_color": "<acento del sitio>",
  "icons": [ {"src": "img/icono-192.png", "sizes": "192x192", "type": "image/png"},
             {"src": "img/icono-512.png", "sizes": "512x512", "type": "image/png"},
             {"src": "img/icono-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"} ] }
```

- El `<head>` de `index.html` y de las paginas por busqueda enlaza el manifiesto, define `theme-color` (claro y
  oscuro) y el icono de Apple. Rutas relativas: funcionan bajo `/la-pichincha/` y con dominio propio.
