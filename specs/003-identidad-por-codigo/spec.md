# Feature Specification: Identidad de producto por codigo de modelo

**Feature Branch**: `003-identidad-por-codigo`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "Identidad de producto por codigo de modelo (Fase 2, F2.1 de docs/plan-de-escalado.md). Hoy el mismo producto en distintas tiendas aparece como avisos sueltos porque agrupar por nombre parecido ya se probo y fallo. Se extrae el codigo de modelo (part number, por ejemplo KF432C16BB/16 o CT1000P3SSD8) del nombre de cada aviso con reglas por rubro, y se agrupa el mismo producto entre tiendas SOLO cuando el codigo coincide exacto. Asi la persona ve un producto con el precio de cada tienda, y el mejor precio de verdad comparable. Se arranca por memorias RAM, SSD y placas de video. Se mide la cobertura por rubro y se publica ese numero. Sin codigo o con codigo dudoso, el aviso queda como hoy, sin agrupar: nunca se junta por parecido. No se agrega pantalla nueva fuera de mostrar el grupo en los resultados existentes (principio V); dato honesto (principio II): un grupo mal armado es peor que ninguno."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver un producto con el precio de cada tienda (Priority: P1)

Una persona busca "ssd 1tb" o "kingston fury 16gb". Cuando el mismo modelo exacto lo venden varias
tiendas, ve una sola fila del producto con el precio de cada tienda y cual es la mas barata, en vez de
varias filas sueltas que tiene que reconocer a ojo.

**Why this priority**: es el motivo de la feature. Hoy comparar el mismo modelo entre tiendas exige leer
nombres distintos ("KINGSTON FURY BEAST 16GB 3200" contra "Memoria Kingston 16gb ddr4 KF432C16BB/16") y
adivinar si es lo mismo.

**Independent Test**: buscar un modelo que dos tiendas venden con el mismo codigo y ver una sola fila con
los dos precios; buscar uno que solo vende una tienda y ver que sigue como siempre.

**Acceptance Scenarios**:

1. **Given** dos o mas avisos de tiendas distintas con el mismo codigo de modelo, **When** aparecen en un
   resultado, **Then** se muestran como un producto con un precio por tienda, ordenados por precio, y el
   mas barato marcado.
2. **Given** un aviso sin codigo, o con un codigo que ninguna otra tienda tiene, **When** aparece en un
   resultado, **Then** se ve igual que hoy.
3. **Given** un producto agrupado, **When** la persona toca el precio de una tienda, **Then** llega al
   producto en la web de esa tienda, como hoy.

---

### User Story 2 - Que el mejor precio sea de verdad comparable (Priority: P1)

La "mejor compra" y la mediana de un resultado cuentan cada producto una vez. Un modelo que cinco tiendas
venden no pesa cinco veces en la mediana, y el mejor precio de un producto agrupado es el de la tienda mas
barata del mismo modelo exacto.

**Why this priority**: sin esto el numero que mas se mira (mediana, mejor compra) queda sesgado hacia los
modelos mas repetidos. Es el principio II: el dato tiene que ser honesto.

**Independent Test**: un resultado con un modelo repetido en 3 tiendas y otro unico: la mediana y el conteo
cuentan 2 productos, no 4 avisos.

**Acceptance Scenarios**:

1. **Given** un modelo agrupado en 3 tiendas, **When** se calcula la mediana, **Then** entra una sola vez
   con su precio mas bajo.
2. **Given** el conteo de resultados, **When** hay productos agrupados, **Then** el texto dice cuantos
   productos y cuantos avisos son ("41 productos en 58 avisos").

---

### User Story 3 - Nunca un grupo mal armado (Priority: P1)

Un grupo solo existe si el codigo coincide exacto. Dos modelos parecidos (misma marca, misma capacidad,
distinto codigo) nunca se juntan, ni dos avisos con un codigo que en realidad es una especificacion
("3200MHZ", "2X16GB", "A520M-K") y no un modelo. Ante la duda, el aviso queda suelto.

**Why this priority**: un grupo mal armado le muestra a la persona un precio que no es de lo que va a
comprar. Es peor que no agrupar. Por eso la regla es estricta y se prueba con casos reales.

**Independent Test**: una muestra revisada a mano de grupos reales de cada rubro, sin un solo grupo con
modelos distintos.

**Acceptance Scenarios**:

1. **Given** dos avisos con codigos que difieren en un caracter (por ejemplo `KF432C16BB/16` y
   `KF432C16BB1/16`), **When** se agrupa, **Then** quedan separados.
2. **Given** un aviso cuyo "codigo" es una velocidad, una capacidad, un formato o un chipset, **When** se
   extrae el codigo, **Then** no se toma como codigo de modelo.
3. **Given** un aviso con dos codigos que apuntan a productos distintos, **When** se agrupa, **Then**
   queda suelto.

---

### User Story 4 - Saber cuanto cubre (Priority: P2)

El dueño del sitio ve, por rubro, cuantos avisos tienen codigo de modelo y cuantos quedan agrupados, en
cada corrida diaria, y la cifra se publica para seguir su evolucion.

**Why this priority**: el plan pide medir la cobertura y arrancar por los rubros donde rinde. Sin la cifra
no se sabe si la regla de cada rubro sirve ni donde invertir despues.

**Independent Test**: correr la generacion y ver, por rubro, avisos totales, con codigo y agrupados.

**Acceptance Scenarios**:

1. **Given** una corrida diaria, **When** termina, **Then** deja la cobertura por rubro (RAM, SSD, placas
   de video) en un archivo publicado y en el resumen de la Action.
2. **Given** que la cobertura de un rubro baja de golpe respecto de la corrida anterior, **When** se
   publica, **Then** la baja se ve en el resumen (puede significar que una tienda cambio sus nombres).

---

### Edge Cases

- Un mismo codigo escrito distinto entre tiendas (con o sin guion, con barra, mayusculas): se normaliza la
  forma antes de comparar, pero la comparacion sigue siendo exacta.
- Una tienda con dos avisos del mismo codigo: aparece una sola vez en el grupo, con su precio mas bajo.
- Un precio de una tienda que no se pudo verificar hoy: conserva su aviso de "precio del dia X" dentro del
  grupo (FR-017 de la spec 001).
- Un codigo que sirve para un kit de 2 y de 4 modulos: si el nombre dice capacidades o cantidades
  distintas, no se agrupan.
- Productos fuera de los tres rubros: no cambian en nada.
- Una tienda deja de vender el producto: el grupo se achica o vuelve a ser un aviso suelto en la corrida
  siguiente.
- Avisos usados, reacondicionados o "bulk/OEM" contra nuevos con el mismo codigo: no se agrupan si el
  nombre marca esa diferencia.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extraer, del nombre de cada aviso de RAM, SSD y placas de video, un codigo
  de modelo cuando el nombre lo trae, con reglas propias de cada rubro.
- **FR-001a**: Cuando el catalogo de una tienda publica el part number del producto (CompraGamer:
  `codigo_principal`), ese codigo manda sobre el del nombre, y se le asigna a los avisos de otras tiendas
  cuyo nombre nombra ese codigo EXACTO (un token entero igual).
- **FR-002**: El sistema DEBE agrupar avisos de tiendas distintas solo cuando su codigo de modelo coincide
  exacto, despues de normalizar mayusculas, espacios y separadores.
- **FR-003**: El sistema NO DEBE agrupar por parecido de nombre, de marca, de capacidad ni de codigo
  parcial, bajo ninguna circunstancia.
- **FR-004**: El sistema NO DEBE tomar como codigo de modelo una velocidad, una capacidad, un formato, un
  chipset ni un nombre de placa madre; la lista de lo que no es codigo vive con las reglas de cada rubro.
- **FR-005**: Un aviso sin codigo, con un codigo dudoso o con mas de un codigo candidato DEBE quedar suelto,
  como hoy.
- **FR-006**: Los resultados DEBEN mostrar un grupo como un producto con una fila por tienda, ordenada por
  precio, con el mas barato marcado, usando las pantallas existentes y sin vistas nuevas.
- **FR-007**: Cada precio de un grupo DEBE enlazar al producto en la web de su tienda y conservar los
  avisos de precio no verificado que hoy lleva cada aviso.
- **FR-008**: La mediana, la mejor compra y el conteo de resultados DEBEN contar cada producto agrupado una
  sola vez, con su precio mas bajo, y el conteo DEBE decir productos y avisos.
- **FR-009**: Una tienda con varios avisos del mismo codigo DEBE aparecer una sola vez dentro del grupo,
  con su precio mas bajo.
- **FR-010**: Las paginas por busqueda (`/precios/...`) DEBEN reflejar los mismos grupos que la busqueda
  interactiva.
- **FR-011**: Cada corrida DEBE calcular y publicar, por rubro, el total de avisos, cuantos tienen codigo
  de modelo y cuantos quedaron en un grupo de dos o mas tiendas, y mostrar en el resumen cuando la
  cobertura de un rubro cae mas de 10 puntos respecto de la corrida anterior.
- **FR-012**: Agrupar NO DEBE depender del orden en que llegan las tiendas: la misma entrada da siempre los
  mismos grupos.
- **FR-013**: La busqueda, la exportacion (CSV, Excel, texto) y los enlaces compartidos DEBEN seguir
  funcionando, y cada aviso individual sigue estando disponible para quien lo busque.

### Key Entities

- **Codigo de modelo**: texto normalizado que identifica un producto exacto de un fabricante, con su rubro
  y las reglas que lo extrajeron. Puede no existir.
- **Grupo de producto**: conjunto de avisos de tiendas distintas con el mismo codigo de modelo; tiene un
  nombre para mostrar, el precio mas bajo y un precio por tienda.
- **Cobertura**: por rubro y por corrida, avisos totales, avisos con codigo, avisos agrupados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En una muestra de al menos 100 grupos reales por rubro (o todos, si hay menos), revisada a
  mano, 0 grupos juntan modelos distintos.
- **SC-002**: Para los rubros prioritarios, el 40% de los avisos cuyo modelo exacto vende mas de una tienda
  queda agrupado por codigo; el porcentaje real de cada rubro queda publicado aunque no llegue.
- **SC-003**: La mediana y el conteo de un resultado con grupos cuentan cada producto una vez, verificado
  con casos de prueba que comparan contra el calculo sin agrupar.
- **SC-004**: Abrir la pagina y buscar sobre el indice completo no se siente mas lento que hoy.
- **SC-005**: El indice publicado no crece mas de 5% por llevar el codigo de modelo.
- **SC-006**: La cobertura por rubro aparece en cada corrida diaria, sin pasos manuales.

## Assumptions

- Medido sobre el indice del 2026-10-09: con solo el nombre, 2 a 5% de los avisos de cada rubro tiene codigo y
  hay 2 grupos; sumando el SKU del catalogo de CompraGamer sube a 13-27% con codigo y 4 grupos. El objetivo
  de SC-002 (40%) depende de que mas tiendas publiquen su part number.
- Los nombres de varias tiendas no traen codigo de modelo; para esos avisos la feature no cambia nada. La
  cobertura real puede quedar lejos del objetivo y se publica igual; ampliar la cobertura (por ejemplo con
  una tabla curada de equivalencias) queda para despues y no es parte de esta feature.
- El agrupado se calcula al armar el indice, no en el navegador: el navegador solo muestra grupos ya
  armados.
- Rubros fuera de RAM, SSD y placas de video no se tocan en esta fase.
- Los avisos de ComparaYa (agregador) entran al agrupado como cualquier otra fuente, rotulados con su
  origen como hoy.
- El orden de las tiendas dentro de un grupo no depende de comisiones ni acuerdos (principio II y regla
  fija de monetizacion).
