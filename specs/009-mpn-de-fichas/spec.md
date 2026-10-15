# Feature Specification: Part number desde la ficha del producto

**Feature Branch**: `009-mpn-de-fichas`

**Created**: 2026-10-15

**Status**: Implemented (RAM y SSD de Venex y Mexx; placas de video, descartadas)

**Input**: Fase B, B3-bis de docs/plan-v2.md: "El MPN de las mismas fichas de Venex (`MODELO:`) y Mexx (`Modelo`) contra el SKU de CompraGamer.
A confirmar con una muestra mayor. Meta: 40% agrupado en RAM, SSD y placas." Nace de la medicion de `specs/007-identidad-por-gtin/viabilidad.md`.

## Medicion previa

Fecha: 2026-10-15, sobre el `indice.json` publicado ese dia (9.520 avisos) y las fichas reales de Venex y Mexx.

**Muestra**: 138 fichas, 0 errores (81 de Venex y 57 de Mexx), con 4 s de pausa entre pedidos y una tienda por proceso. Son los avisos de
RAM, SSD y placas que pueden coincidir con alguno de CompraGamer (misma capacidad y una marca en comun en el nombre): los demas no tienen
con quien agruparse por codigo. Se leyo el codigo con las mismas guardas que ya usa `modelo.sku_de` (letras y numeros, sin espacios, 5 o mas caracteres).

**Donde esta el codigo**

| Tienda | Etiqueta | Observaciones |
|---|---|---|
| Venex | `<p>MODELO: SA400S37/480G \| GTIN: 740617263442</p>` | En el 100% de las fichas; hay que cortar el GTIN que viene pegado. Dos bloques por pagina (escritorio y movil) con el mismo valor |
| Mexx | `P/N` en SSD y placas (42 de 57 fichas); `Modelo` en RAM y otras (44 de 57) | `Modelo` a veces es el nombre comercial ("WD Green SN350 NVMe SSD 1TB , TLC"): la guarda de forma lo descarta. `P/N` manda cuando esta |

**Cuanto agrupa** (cobertura con `cobertura.informe`, antes y despues de poner el codigo de la ficha en los avisos de Venex y Mexx):

| Rubro | Avisos | Agrupados hoy | Agrupados con la ficha | Ganancia | Grupos |
|---|---:|---:|---:|---:|---:|
| RAM | 187 | 0 (0,0%) | 11 (5,9%) | **+5,9 puntos** | 0 → 5 |
| SSD | 150 | 0 (0,0%) | 16 (10,7%) | **+10,7 puntos** | 0 → 6 |
| Placas de video | 501 | 4 (0,8%) | 10 (2,0%) | +1,2 puntos | 2 → 5 |

De las 138 fichas, 73 trajeron un codigo con forma valida y 16 coincidieron con el de un aviso de CompraGamer (RAM 5, SSD 9, placas 2).
Las placas de video de Venex no aportan nada (0 de 50 con codigo valido: publica nombres comerciales con espacios y parentesis).
Se revisaron las 16 parejas a mano: todas son el mismo producto (Kingston A400 480GB y 960GB, NV3 500GB y 1TB, Adata SU650, Corsair Vengeance 8GB y 16GB, etc.).

**Conclusion**: supera el umbral de 5 puntos (el mismo que descarto el GTIN) en **RAM y SSD**; en **placas de video** no (+1,2). Se implementa solo
para RAM y SSD: pedir ~80 fichas de placas para ganar 1 punto no se justifica. La meta del 40% del plan sigue lejos (6% y 11%): lo que falta no
se arregla leyendo mas fichas de estas dos tiendas, sino sumando fuentes que publiquen part number (Fase B1).

## User Scenarios & Testing

### User Story 1 - El mismo SSD o memoria en mas tiendas (Priority: P1)

Una persona busca "ssd 480gb kingston a400" y ve el producto UNA vez, con el precio mas bajo y debajo "Tambien en" las otras tiendas, ahora
tambien Venex y Mexx cuando venden el mismo codigo.

**Independent Test**: indexar con una tienda que publica el codigo solo en la ficha: el aviso sale con su codigo en la columna `modelo` y se
agrupa con el de la otra tienda.

**Acceptance Scenarios**:

1. **Given** una tienda con `ficha` en `tiendas.json`, **When** corre el indexado, **Then** los avisos de RAM y SSD sin codigo piden su ficha y
   el codigo (si tiene forma valida) va a la columna `modelo`.
2. **Given** una ficha ya leida, **When** vuelve a correr el indexado, **Then** no se vuelve a pedir: sale de la cache.
3. **Given** una tienda que bloquea (403, 429 o 503), **When** se piden las fichas, **Then** se corta ese dia y el indice sale igual, con lo que ya estaba.

## Requirements

- **FR-001**: Sumar una tienda con codigo en la ficha DEBE ser configuracion (`"ficha": {"extractor", "rubros", "tope"}` en `tiendas.json`) mas,
  como mucho, una expresion en `modelo._FICHAS`.
- **FR-002**: El codigo DEBE pasar las mismas guardas que el SKU de un catalogo (`modelo._FORMA_SKU`): ante la duda el aviso queda suelto.
  Dos codigos distintos en una ficha no se eligen.
- **FR-003**: Se pide la ficha de un aviso UNA vez: el resultado (tambien "sin codigo") queda en `fichas.json`, en la rama `historial`, y una
  ficha sin codigo se reintenta a los 30 dias. Lo guardado de un aviso que ya no se publica se descarta a los 60 dias.
- **FR-004**: Como mucho `tope` fichas nuevas por corrida y tienda, con 4 s de pausa (principio III). El resto queda para la corrida siguiente.
- **FR-005**: Un bloqueo (403, 429, 503) corta los pedidos de esa tienda en esa corrida; un 404 o un error de red no se guarda y se reintenta.
  Nunca se esquiva un bloqueo.
- **FR-006**: Un aviso usado, reacondicionado, bulk u OEM no pide ficha (no se agrupa con lo nuevo).
- **FR-007**: El indice no cambia de forma: el codigo va en la columna `modelo` que ya existe.

## Success Criteria

- **SC-001**: Con la cache llena, una corrida sin avisos nuevos no hace ningun pedido de ficha.
- **SC-002**: La cobertura de RAM sube al menos 5 puntos y la de SSD al menos 5, medida con `cobertura.py` despues de llenar la cache (con `tope` 40
  por tienda, de dos a cuatro corridas diarias).
- **SC-003**: Ninguna pareja agrupada por esta via junta capacidades distintas (lo garantiza `agruparPorModelo`, que ya compara capacidades).

## Assumptions

- Venex permite recorrer las fichas `.html` en su `robots.txt`; Mexx no tiene `robots.txt` (404). Se piden con el mismo `User-Agent` y ritmo que el resto.
- Costo la primera vez: unas 65 fichas de Venex y 93 de Mexx en RAM y SSD; con `tope` 40, entre dos y tres corridas. Despues, solo los avisos nuevos.
- Una ficha cuyo codigo repite el de otra (variantes de color con el mismo part number) no es un error: son el mismo producto para este comparador.
- Las placas de video quedan afuera; si una tienda nueva publica el codigo en el listado, el rubro entra por configuracion sin tocar codigo.
