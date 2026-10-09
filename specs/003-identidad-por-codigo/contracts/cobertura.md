# Contrato: cobertura (`cobertura.py`)

- `python cobertura.py indice.json --salida _sitio/cobertura.json [--previa URL] [--resumen RUTA]`
- Escribe `cobertura.json` (ver data-model.md).
- Si hay `--previa` y se pudo bajar, compara por rubro la cobertura de extraccion; una caida de mas de 10
  puntos sale marcada en el resumen (`$GITHUB_STEP_SUMMARY`) con "revisar nombres de tiendas".
- Si no se puede bajar la anterior, sigue sin comparar. Nunca falla la corrida por esto.
