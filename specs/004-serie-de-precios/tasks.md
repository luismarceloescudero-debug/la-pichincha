# Tasks: Serie de precios por producto

**Tests**: INCLUIDOS (principio IV, TDD): cada tarea de codigo escribe primero el test, lo ve fallar y despues implementa.

- [x] T001 Tests que fallan en `tests/test_serie.py` para `serie.cargar(carpeta)`: lee todos los CSV del historial (varios meses) y devuelve, por (tienda, id), la lista ordenada de (fecha, precio) con el precio vacio como baja; mas `serie.precio_el(eventos, dia)` (precio vigente un dia, llevando hacia adelante) y `serie.dias_de_historia(eventos, hoy)`; luego crear `serie.py`
- [x] T002 [US1] Tests que fallan para `sellos_de` minimo: 40 dias de historia y precio de hoy igual al minimo de 30 -> `m`; mas barato hace 10 dias -> sin `m`; 100 dias con minimo de 90 -> solo `h`; menos de 30 dias -> nada; un solo precio en toda la historia con 40 dias -> `m`; implementar
- [x] T003 [US2] Tests que fallan para la rebaja inflada: 100 -> 130 -> 105 -> `x`; 100 -> 80 -> sin `x`; menos de 14 dias de historia -> sin `x`; ultimo cambio que no es una baja -> sin `x`; baja que cae mas de 3% por debajo del piso -> sin `x`; implementar
- [x] T004 [US1] Test que falla en `tests/test_indexar_corrida.py` y luego cablear en `indexar.py`: las letras de serie se suman a `sellos` de cada fila, con el historial leido de la carpeta de historial; un producto sin historia queda con sus sellos de siempre
- [x] T005 [P] [US1] Tests que fallan en `tests/js/buscador.test.js` para `sellosDe("m")`, `("h")`, `("x")` y su combinacion con los de siempre; luego agregar las tres entradas a `SELLOS` en `js/buscador.js`
- [x] T006 [P] [US3] Tests que fallan en `tests/test_cobertura.py` y luego `cobertura.py`: `serie` en `cobertura.json` con cuantos avisos tienen `m`, `h`, `x`, y en el resumen de la Action; los dias de historia salen del indice (`generado` y el primer dia del historial se pasan como argumento opcional `--historial`)
- [x] T007 [P] README (seccion de la serie de precios, la fecha desde la que aparecen los sellos) y marcar F2.2 en `docs/plan-de-escalado.md`
- [ ] T008 Ambas suites, PR contra `main`, CI en verde, merge (rebase), deploy y aviso

## Dependencias
T001 -> T002 -> T003 -> T004; T005, T006 y T007 son independientes entre si (despues de T001).
