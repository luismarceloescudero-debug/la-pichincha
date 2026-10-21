# Feature Specification: Serie de precios por producto

**Feature Branch**: `004-serie-de-precios`

**Created**: 2026-10-09

**Status**: Implementada

**Input**: User description: "Serie de precios por producto (Fase 2, F2.2 de docs/plan-de-escalado.md). Con el historial de precios que ya se guarda, cada aviso puede decir si hoy esta en su precio minimo de 30 o de 90 dias, y se marca con un sello 'subio antes de la oferta' a las rebajas infladas, las que suben el precio y despues lo bajan casi al nivel de antes. Es el dato que nadie muestra para hardware en 5 tiendas. Sin pantallas nuevas: son sellos en los resultados, las ofertas y las paginas por busqueda. Dato honesto (principio II): solo se afirma lo que el historial alcanza a probar; con menos de 30 dias de historia no hay sello de minimo de 30 dias."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Saber si hoy es el mejor precio en un mes (Priority: P1)

Una persona ve un producto con el sello "minimo de 30 dias" cuando su precio de hoy es el mas bajo que tuvo en
esa tienda en los ultimos 30 dias (o "minimo de 90 dias" si lo es en tres meses). Le dice si conviene comprar ahora o
esperar, sin abrir ninguna pantalla nueva.

**Why this priority**: es lo que el plan llama el foso: ninguna comparadora argentina muestra la serie de
precios de hardware en varias tiendas.

**Independent Test**: con un historial de 40 dias donde un producto baja a su valor mas bajo hoy, el aviso lleva el
sello de 30 dias; con un producto que fue mas barato hace 10 dias, no.

**Acceptance Scenarios**:

1. **Given** un producto con al menos 30 dias de historia y precio de hoy menor o igual al de cualquier dia de
   los ultimos 30, **When** aparece en un resultado, **Then** lleva el sello "mínimo de 30 días".
2. **Given** lo mismo con 90 dias de historia y de 90 dias, **Then** lleva "mínimo de 90 días" (y no el de 30).
3. **Given** un producto con menos de 30 dias de historia, **When** aparece, **Then** no lleva sello de minimo.

---

### User Story 2 - Desconfiar de la rebaja inflada (Priority: P1)

Una oferta que en realidad subio el precio y despues lo bajo casi al nivel de antes lleva el sello "subió antes de la
oferta", para que la persona no la tome por una baja de verdad.

**Why this priority**: ya mostramos "bajó N%"; sin este sello una rebaja inflada se ve igual que una real y rompe
la confianza en el resto de los sellos.

**Independent Test**: un producto que estaba en 100, subio a 130 y bajo a 105 lleva el sello; uno que estaba en 100,
bajo a 80, no.

**Acceptance Scenarios**:

1. **Given** un producto cuyo ultimo cambio fue una baja y que en los 30 dias anteriores a esa baja habia estado
   al menos 10% mas barato que su precio previo, y el precio nuevo no baja de ese piso (menos del 3% por debajo),
   **When** aparece, **Then** lleva el sello "subió antes de la oferta".
2. **Given** una baja que lleva el precio por debajo de todo lo visto en los 30 dias anteriores, **Then** no lleva el
   sello.
3. **Given** menos de 14 dias de historia del producto, **Then** no lleva el sello.

---

### User Story 3 - Saber desde cuando se afirma (Priority: P2)

El dueño del sitio ve en la corrida diaria cuantos avisos llevan cada sello y de cuantos dias es el historial, para
saber cuando empiezan a aparecer y si algo anda mal.

**Independent Test**: correr la medicion y ver los tres conteos y los dias de historia.

**Acceptance Scenarios**:

1. **Given** una corrida diaria, **When** termina, **Then** `cobertura.json` y el resumen de la Action dicen cuantos avisos
   tienen "mínimo de 30 días", "mínimo de 90 días" y "subió antes de la oferta", y cuantos dias de historia hay.

---

### Edge Cases

- Producto que se dejo de publicar y volvio: cuenta como nuevo (el historial ya lo trata asi); su historia empieza de
  nuevo.
- Producto con un solo precio en toda su historia: es su minimo, pero con historia suficiente igual lleva el sello de minimo.
- Meses distintos: la serie sale de todos los CSV del historial, no solo del mes actual.
- Una fuente con salud mala: sus bajas no se registran (regla del historial), asi que no genera sellos falsos.
- Avisos sin historial (producto nuevo en el indice): sin sello.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE reconstruir la serie de precios de cada producto (tienda y URL) a partir del historial de
  cambios, llevando el precio hacia adelante entre cambios.
- **FR-002**: Un aviso DEBE llevar "mínimo de 30 días" solo si tiene al menos 30 dias de historia y su precio de hoy es
  menor o igual al de cualquier dia de los ultimos 30; "mínimo de 90 días" con 90 dias de historia y de 90.
- **FR-003**: Un aviso con ambos minimos DEBE llevar solo el de 90 dias.
- **FR-004**: Un aviso DEBE llevar "subió antes de la oferta" cuando su ultimo cambio fue una baja de los ultimos 30 dias, tiene al menos 14 dias
  de historia, y en los 30 dias anteriores a la baja estuvo un 10% o mas por debajo de su precio previo sin que la baja
  llegue mas de 3% por debajo de ese piso.
- **FR-005**: Los sellos DEBEN verse en las mismas filas y tarjetas donde hoy se ven los demas (resultados de busqueda,
  ofertas, paginas por busqueda), sin vistas nuevas.
- **FR-006**: Sin historia suficiente el sistema NO DEBE afirmar nada: ningun sello.
- **FR-007**: La medicion diaria DEBE publicar cuantos avisos llevan cada sello y los dias de historia.
- **FR-008**: El peso del indice NO DEBE crecer mas de 1% por esta feature.

### Key Entities

- **Serie de un producto**: lista de (fecha, precio) del historial, con el precio vigente cada dia.
- **Sello de serie**: minimo de 30 dias, minimo de 90 dias, subio antes de la oferta.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con un historial de prueba que cubre cada caso (minimo, no minimo, inflada, baja real, poca historia), el 100% de los
  sellos coincide con lo esperado.
- **SC-002**: Cuando el historial llega a 30 dias, los avisos con minimo de 30 dias aparecen sin ningun paso manual.
- **SC-003**: El indice no crece mas de 1%.
- **SC-004**: Ninguna pantalla nueva: los sellos usan los componentes que ya existen.

## Assumptions

- El historial empezo el 2026-10-07: los sellos de 30 dias recien pueden aparecer desde el 2026-11-06 y los de 90 desde
  el 2027-01-05. Hasta entonces la feature esta lista pero no muestra nada, a proposito.
- El grafico de la serie se hizo despues, en D2 de `docs/plan-v2.md`, como una ampliacion de esta spec (ver abajo): no es
  una vista nueva, se abre en la misma fila del aviso con un boton.
- Los sellos viajan en la columna `sellos` del indice (una letra por sello), sin columnas nuevas.
- La rebaja inflada se evalua sobre el ultimo cambio de cada producto: una baja anterior ya absorbida no se marca.

## Ampliacion: grafico del historial de un aviso (D2 de `docs/plan-v2.md`, 21/10/2026)

Es el feature mas pedido entre los referentes (ComparaYa, Solotodo, Keepa, PCPartPicker): ver el recorrido del
precio, no solo el sello.

### Historias

1. **Ver el recorrido del precio de un aviso**: en cada fila de la busqueda y en cada tarjeta de ofertas, el boton
   "Historial de precio" abre un SVG inline con la serie y cuatro cifras: hoy, minimo (con la fecha en que rigio),
   maximo (con fecha) y variacion contra el primer dia del tramo.
2. **Saber de cuanto es la historia**: el panel dice en letras "N dias de datos" y desde que dia se sigue ese aviso. No
   afirma nada de antes de ese dia ni un "minimo historico" que los datos no prueban.
3. **Acotar el rango cuando se puede**: con datos suficientes ofrece 7, 30 y 90 dias y "todo". Un rango cuya fecha de
   inicio no esta cubierta no se ofrece (con 14 dias de historia: 7 dias y todo).
4. **Sin historia, decirlo**: con menos de dos puntos el panel dice "Todavia no hay historia suficiente" y no dibuja nada.

### Requisitos

- **FR-101**: La serie NO DEBE viajar en `indice.json`: `generar_series.py` deja `<salida>/series/NN.json` en 64
  fragmentos y la pagina baja solo el del aviso que se abre (medido el 21/10: 931 KB crudos y 444 KB gzip en total; el
  fragmento mas grande, 17 KB crudos).
- **FR-102**: La clave del aviso (`cyrb53` sobre tienda, salto de linea y url) y el fragmento DEBEN calcularse igual en
  Python y en JS, con los mismos vectores de prueba en las dos suites.
- **FR-103**: Un aviso cuyo precio de hoy en el indice no coincide con el ultimo del historial, que ya no se publica o
  que tiene un solo punto NO DEBE tener serie.
- **FR-104**: El grafico DEBE ser `role="img"` con el resumen textual en el `aria-label`, llevar una tabla alternativa con
  el precio de cada fecha y funcionar sin color.
- **FR-105**: `generar_series.py` DEBE quitar los fragmentos que ya no corresponden en cada corrida y no escribir nada si
  falta el historial.

### Criterios medibles

- **SC-101**: `node --test` y `unittest` cubren: serie valida, un solo punto, aviso que dejo de publicarse y volvio,
  varias corridas el mismo dia, precio plano (sin division por cero), rangos que los datos no cubren, escapado de texto
  y error de red distinto de falta de historia.
- **SC-102**: El fragmento que baja el navegador es de decenas de KB, nunca el CSV del historial (14,2 MB) ni el indice
  (1,5 MB gzip).
