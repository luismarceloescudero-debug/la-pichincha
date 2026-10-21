# Contrato: `consultas.json`

```json
[{ "q": "ssd 1tb", "nota": "rubro con 170 avisos en 8 comercios" }]
```

- `q` obligatorio, 2 a 60 caracteres; unico por slug.
- Agregar una entrada y publicar crea su pagina; quitarla deja la URL sin pagina (el generador avisa).
- Las paginas de `consultas.json` son las curadas y van primero; `generar_consultas.js` agrega las que descubre en el indice (ver README, "Consultas automaticas").
