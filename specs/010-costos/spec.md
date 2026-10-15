# Feature Specification: Costo real de una compra (calculadora de costos): normativa verificada

**Feature Branch**: `010-costos`

**Created**: 2026-10-15

**Status**: K0 hecha (normativa verificada); K1 a K5 por hacer

**Input**: Plan v3, fase K0 (`docs/plan-calculadora.md`): "verificar contra el Boletin Oficial y las paginas de ARCA, una por una, las filas
prensa y dudoso" y escribir `importacion.json` con fuente, fecha y nivel de confianza de cada regla. Pedido del dueño: "una calculadora de costos,
detallados, con impuestos, con aranceles de aduana, envios, etc; tambien un selector de monedas con conversion en tiempo real".

## Como se verifico (15/10/2026)

Se leyo el texto de cada norma en `argentina.gob.ar/normativa` y las paginas de ARCA, no notas de prensa. Donde una cifra solo la daba la prensa o un
estudio, se busco la norma; si no aparecio, la regla quedo **prensa**, **dudoso** o **pendiente**, nunca con un numero supuesto.

| Fuente leida | Que se saco |
| --- | --- |
| [Decreto 604/2026](https://www.argentina.gob.ar/normativa/nacional/norma-427768/texto) (BO 17/07/2026) | USD 400 por envio, 5 envios por año y por persona, exencion de derechos de importacion y tasa de estadistica; el excedente paga los tributos del regimen general. No menciona el IVA |
| [RG ARCA 5884/2026](https://www.argentina.gob.ar/normativa/nacional/norma-428387/texto) (BO 30/07/2026) | Alcance (operador postal designado y puerta a puerta), tope de USD 3.000 FOB, 3 unidades, 24 horas para validar. **Entra en vigencia el 30/07 pero se implementa por etapas** (cronograma en el micrositio de ARCA, no en el texto) |
| [ARCA, puerta a puerta](https://www.afip.gob.ar/envios-internacionales/puerta-a-puerta/monto.asp) y [pequeños envios por courier](https://www.afip.gob.ar/envios-internacionales/courier/importacion/pequenios-envios.asp) | Dentro de la franquicia solo IVA e impuestos internos; el excedente paga la totalidad de los tributos del regimen general «sobre el excedente»; con el cupo agotado, sobre el valor total; 50 kg; tasa de servicio del Correo |
| [Decreto 1065/2024](https://www.argentina.gob.ar/normativa/nacional/decreto-1065-2024-406688/texto) | El regimen courier original (USD 400, 5 envios). Sin alicuotas ni IVA |
| [Decreto 1140/2024](https://www.argentina.gob.ar/normativa/nacional/norma-407914/texto) | Tasa de estadistica del 3% prorrogada hasta el 31/12/2027. Menciona topes maximos en una imagen ilegible |
| [Ley de IVA, Decreto 280/1997](https://www.argentina.gob.ar/normativa/nacional/decreto-280-1997-42701/texto) | Art. 25: base = precio normal mas todos los tributos a la importacion. Art. 28: 21% general; el Poder Ejecutivo puede fijar alicuotas diferenciales de hasta el 50% menos |
| [Decreto 333/2025](https://www.argentina.gob.ar/normativa/nacional/decreto-333-2025-412953/texto) y [comunicado](https://www.argentina.gob.ar/noticias/el-gobierno-nacional-eliminara-impuestos-productos-electronicos-para-alentar-la-baja-de) | Celulares: derecho 8% y 0% desde el 15/01/2026. Impuesto interno de celulares, TV y aires importados: 9,5% (era 19%). Consolas: remite al Arancel Externo Comun |
| [RG ARCA 5617/2024, texto actualizado](https://www.argentina.gob.ar/normativa/nacional/norma-407430/actualizacion) | Percepcion del 30% sobre pagos en pesos con tarjeta de bienes y servicios del exterior; modificatorias solo de 2025 |

## Lo que se corrigio respecto del plan

- **La percepcion del 30% sigue en el texto oficial.** Las notas de prensa de enero de 2026 que decian que se elimino no tienen respaldo en la RG 5617 actualizada.
  El mercado lo confirma: la cotizacion «tarjeta» de dolarapi.com es exactamente el oficial por 1,30.
- **El IVA no esta en el decreto**, pero ARCA lo dice en sus paginas: dentro de la franquicia se paga IVA. Alicuota general 21% (Ley 23.349 art. 28); la reducida
  del 10,5% sale de decretos por posicion que no se leyeron.
- **El «50% plano» para lo que pasa los topes**, que la prensa discutia, **no figura** en ninguna de las normas ni de las paginas de ARCA leidas: el excedente
  paga los tributos del regimen general. No se incluye.
- **La base del IVA** (Ley 23.349 art. 25) es el valor en aduana mas los derechos y la tasa de estadistica. Leyendo juntas las dos paginas de ARCA, el IVA cae sobre
  todo el valor del envio y los derechos y la tasa solo sobre el excedente.

## Lo que queda pendiente (para un contador o un despachante)

La calculadora **no suma** estos puntos sin avisar; los pide como dato o los muestra como «no incluido, ver nota». Estan en `importacion.json` con nivel `pendiente`.

| Pendiente | Por que importa |
| --- | --- |
| Derecho de importacion de memorias, SSD, placas de video, notebooks, monitores y TV (por posicion NCM) | Es el numero que mas pesa en un excedente y ninguna pagina oficial lo da por rubro |
| Derecho de las consolas (¿20% o Arancel Externo Comun?) | El decreto y el comunicado oficial no coinciden |
| Si el valor sobre el que se calculan los derechos incluye flete y seguro (CIF) | Los arts. 642 a 644 del Codigo Aduanero lo dicen, pero Infoleg indica que la Ley 23.311 los sustituyo |
| IVA reducido del 10,5% en algun rubro de hardware | Cambia el 21% |
| Base del impuesto interno y si integra la base del IVA | Afecta a celulares y TV |
| Percepciones de IVA y Ganancias en courier o Correo | ARCA no las menciona; en el regimen general de importadores llegan a 20% y 6% |
| Honorarios del courier o tasa de servicio del Correo | ARCA no da montos |
| Cronograma de la RG 5884/2026 | Hasta que cada etapa se implemente rige el procedimiento anterior (RG 4447) |
| Topes de la tasa de estadistica del Decreto 1140/2024 | Estan en una imagen que no se pudo leer |

## User Scenarios & Testing

### User Story 1 - Saber cuanto cuesta de verdad importar algo (Priority: P1, K1 y K3)

Una persona quiere traer un producto de USD 800 y ver, renglon por renglon, que impuestos paga y con que confianza esta cada numero.

**Independent Test**: con los casos de referencia de abajo, el motor da el desglose al centavo y marca como «no incluido» lo pendiente.

**Acceptance Scenarios**:

1. **Given** un envio de USD 300 con franquicia disponible, **When** se calcula, **Then** paga solo IVA (USD 63).
2. **Given** un envio que supera los USD 400, **When** se calcula, **Then** derechos y tasa caen solo sobre el excedente y el IVA sobre todo el valor mas esos tributos.
3. **Given** el cupo anual agotado, **When** se calcula, **Then** no hay franquicia: todos los tributos caen sobre el valor total.
4. **Given** una regla pendiente (por ejemplo el derecho de un notebook), **When** se calcula, **Then** la calculadora pide el dato o lo deja como «no incluido» y lo dice.
5. **Given** un envio por Correo Argentino, **When** se calcula, **Then** suma la tasa de servicio y almacenaje que escribio la persona (nunca un monto supuesto) y la muestra aparte de los tributos.
6. **Given** un valor FOB sobre USD 3.000, **When** se calcula, **Then** avisa que no entra en el regimen de pequeños envios (va por regimen general, con despachante).

## Requirements

- **FR-001**: Toda regla de importacion DEBE vivir en `importacion.json` con `valor`, `fuentes`, `norma`, `rige_desde`, `verificado` y `nivel`; ningun numero de normativa va en el codigo.
- **FR-002**: Una regla `oficial` DEBE citar una norma y salir de un dominio del Estado (argentina.gob.ar, boletinoficial.gob.ar, arca.gob.ar, afip.gob.ar, infoleg.gob.ar). Lo `prensa`, `dudoso` o `pendiente` DEBE explicar por que.
- **FR-003**: Una regla `pendiente` DEBE tener `valor` nulo. Un numero inventado no pasa la CI.
- **FR-004**: La pagina DEBE mostrar la fecha de verificacion y avisar si una regla paso 60 dias (K5).
- **FR-005**: El desglose DEBE marcar cada renglon con su nivel de confianza y decir «estimacion, no asesoramiento».
- **FR-006**: Lo dudoso (por ejemplo la percepcion) DEBE poder verse como escenario («con» y «sin»), nunca sumarse en silencio.
- **FR-007**: El desglose DEBE separar tributos (con fuente oficial), honorarios del courier o tasa de servicio del Correo (dato que escribe la persona, con la fecha en que
  lo consulto) y percepciones (escenario), y decir si se pagan **prepagos en el checkout** o **a la entrega** (referentes: Amazon, eBay y Tiendamia, plan v3 seccion 1.1 bis).
- **FR-008**: El resultado DEBE ser una **estimacion con rango**, con la aclaracion de que la liquidacion real puede variar y de quien absorbe la diferencia.
- **FR-009**: El rango cubre lo que no se sabe: el flete dentro o fuera del valor en aduana y, **solo si la persona no dijo como paga** (`medioPago`: tarjeta en pesos o dolares propios), la percepcion. Con el medio de pago conocido, la percepcion entra en los dos extremos o en ninguno.

## Casos de referencia para K1 (derivados de las reglas; ARCA no publica ejemplos numericos)

Se calculan con `franquicia 400`, `tasa de estadistica 3%` e `IVA 21% sobre el valor mas derechos y tasa`. Los derechos de importacion de los casos B y D son un **supuesto** del
test (20%), no una regla verificada.

| Caso | Datos | Derechos | Tasa 3% | Base del IVA | IVA 21% | Tributos |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| A. Dentro de la franquicia | FOB 300 | 0 | 0 | 300 | 63,00 | 63,00 |
| B. Excedente | FOB 800, derecho 20% | 80,00 (20% de 400) | 12,00 | 892 | 187,32 | 279,32 |
| C. Excedente de un celular | FOB 500, derecho 0% | 0 | 3,00 (3% de 100) | 503 | 105,63 | 108,63 |
| D. Cupo agotado | FOB 300, derecho 20% | 60,00 | 9,00 | 369 | 77,49 | 146,49 |
| E. Sobre el tope | FOB 3.500 | fuera del regimen: regimen general con despachante | | | | |

## Success Criteria

- **SC-001**: Cada regla del calculo tiene fuente oficial y fecha, o esta marcada como pendiente (`tests/test_importacion.py` lo exige).
- **SC-002**: Una regla sin tocar hace mas de 120 dias rompe la CI; a los 60, la pagina avisa (K5).
- **SC-003**: Los casos de referencia dan al centavo en K1.

## Assumptions

- La calculadora estima y lo dice; las reglas dudosas se muestran como escenarios.
- La verificacion se repite cada vez que ARCA publique una resolucion sobre envios internacionales y, como minimo, cada 60 dias (K5).
- «Oficial» quiere decir que se leyo el texto o la pagina de ARCA o del Gobierno el 15/10/2026, no que sea una asesoria legal.
