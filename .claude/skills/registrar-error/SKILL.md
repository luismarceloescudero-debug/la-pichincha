---
name: registrar-error
description: Cuando aparece un error que ya paso antes o que cuesta un PR arreglar en La Pichincha, lo registra en docs/errores-conocidos.md con su causa raiz y una guardia (test, hook o regla) que lo detecte si vuelve. Usala al cerrar cualquier arreglo de CI, publicacion o guardia.
---

# Registrar un error para que no vuelva

Ciclo de la regla «Errores que vuelven» del CLAUDE.md del repo. Sin fila y sin guardia, el arreglo no esta terminado.

## Pasos

1. **Buscar el sintoma** en `docs/errores-conocidos.md`. Si ya hay una fila, la guardia fallo: corregir la guardia (o
   ampliarla), no sumar un parche al lado, y actualizar esa fila.
2. **Causa raiz**, no sintoma: para una corrida de CI usar `python herramientas/ci_diagnostico.py <run_id>`; para lo
   demas, `superpowers:systematic-debugging`.
3. **Guardia primero**: escribir el test que falla sin el arreglo (o el hook o paso de CI si no se puede testear), ver que
   falle, arreglar, ver que pase.
4. **Sumar la fila** al final de la tabla con el siguiente `E##`:
   `| E## | clase | sintoma | causa raiz | ruta::fragmento | #PR | dd/mm/aaaa |`
   La guardia va como `ruta::fragmento`: la ruta existe y el fragmento aparece en ese archivo (nombre del test, constante
   o frase de la regla). `tests/test_errores_conocidos.py` lo verifica.
5. **Si la CI lo reconoce por una frase del log**, sumar la firma en `FIRMAS` de `herramientas/ci_diagnostico.py` con su test.
6. **Cerrar el issue de origen** (`la-pichincha-correo`) con el enlace al PR o «ruido conocido E##».
7. Correr `python -m pytest tests/test_errores_conocidos.py tests/test_ci_diagnostico.py -q`.

## Nunca

- Registrar una fila con una guardia que no existe: el test la rechaza.
- Cambiar el sentido de una columna del indice: se agregan o renombran columnas, nunca se les cambia el sentido.
