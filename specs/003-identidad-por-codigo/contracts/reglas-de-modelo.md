# Contrato: reglas de modelo (`modelo.py`)

- `rubro_de(nombre) -> "ram" | "ssd" | "gpu" | None`: por palabras del nombre (memoria/ddr, ssd/nvme/m.2,
  placa de video/geforce/radeon/rtx/rx). Ante nombres que caen en dos rubros devuelve `None`.
- `codigo_de_modelo(nombre, rubro) -> str | None`: devuelve el codigo normalizado solo si exactamente un
  candidato cumple la forma de un part number de ese rubro y no esta en la lista negra (velocidades,
  capacidades, formatos, chipsets, placas madre). Cero candidatos, dos candidatos distintos o duda: `None`.
- Funcion pura, determinista, sin red ni estado. Cada regla nueva entra con un test de nombre real.
- `bloqueado_para_agrupar(nombre) -> bool`: usado, reacondicionado, refurbished, open box, bulk, oem.
