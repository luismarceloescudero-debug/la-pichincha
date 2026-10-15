# Plan v3: cuanto cuesta de verdad cada compra (calculadora de costos y monedas)

Escrito el 2026-10-15. Continua el [plan v2](plan-v2.md): amplia y reemplaza el detalle de su Fase C (C1 reglas de
importacion y C3 calculadora "puesto en tu casa") y le suma un selector de monedas con conversion en vivo. Las reglas de la
constitucion (`.specify/memory/constitution.md`) siguen valiendo; donde este plan pide cambiarlas, lo dice.

**Lo que se pidio:** "una calculadora de costos, detallados, con impuestos, con aranceles de aduana, envios, etc; tambien un
selector de monedas con conversion en tiempo real".

## 1. Lo que se verifico hoy (15/10/2026)

Antes de planear se midio que existe y que no. Hay normas de julio de 2026 y las notas de prensa no coinciden entre si, asi que cada
dato lleva su nivel de confianza: **oficial** (pagina de ARCA o del Gobierno, leida hoy), **prensa** (medio o estudio, sin la norma a
la vista) o **dudoso** (fuentes que se contradicen).

### 1.1 Normativa de importacion

> **Actualizacion del 15/10/2026 (K0 hecha).** Se leyeron los textos oficiales y casi todo lo marcado «prensa» o «dudoso» abajo quedo confirmado o
> corregido: el excedente paga los tributos del regimen general (el «50% plano» no figura en ninguna norma), el IVA de 21% y su base (Ley 23.349 arts. 25 y 28),
> la tasa de estadistica del 3% prorrogada hasta 2027 (Decreto 1140/2024), el impuesto interno de 9,5% (Decreto 333/2025) y **la percepcion del 30% sigue vigente en el
> texto actualizado de la RG 5617**. Lo que no se pudo confirmar (derecho de importacion por rubro, percepciones del courier, honorarios, base del impuesto
> interno, cronograma de la RG 5884) quedo como `pendiente`. Detalle en [`specs/010-costos/spec.md`](../specs/010-costos/spec.md) y en `importacion.json`.

| Regla | Dato | Fuente | Nivel |
| --- | --- | --- | --- |
| Franquicia de pequeños envios (courier privado y Correo, incluido puerta a puerta) | hasta **USD 400 FOB por envio** exentos de derechos de importacion y tasa de estadistica | ARCA, novedad del 30/07/2026 (RG 5884/2026, que reglamenta el Decreto 604/26) | oficial |
| Cantidad de envios | hasta **5 por año y por persona** | ARCA, ibidem | oficial |
| Tope por envio | **USD 3.000 FOB** por envio; paquetes de hasta 50 kg | ARCA (RG 5883/2026 para courier) | oficial |
| Unidades | hasta **3 unidades de la misma especie**, uso personal, sin fin comercial | ARCA, ibidem | oficial |
| Excedente de la franquicia | paga "los tributos del regimen general" (derecho de importacion segun la posicion NCM + tasa de estadistica). **No se encontro la alicuota fija**; una nota dice que el 50% plano se elimino y otra que no | ARCA no detalla alicuotas; prensa contradictoria | **dudoso** |
| IVA | 21% sobre FOB + derechos + tasa (ejemplo de un estudio); ARCA no lo trata en esa pagina | arancely.com (12/03/2026, revisada en 09/2026) | prensa |
| Tasa de estadistica | 3% en el ejemplo del estudio | arancely.com | prensa |
| Celulares y smartphones | derecho de importacion **0%** desde el 15/01/2026 (antes 16%, luego 8%) | argentina.gob.ar (Decreto 333/2025) | oficial |
| Impuestos internos (celulares, TV, monitores, aires) | bajan de 19% a 9,5%; 0% si son de Tierra del Fuego con origen acreditado | prensa (la pagina oficial lo menciona sin alicuotas) | prensa |
| Domicilio Fiscal Electronico | obligatorio para el destinatario de courier privado desde el 18/08/2026 | guia de un despachante | prensa |
| Percepcion del 30% a cuenta de Ganancias y Bienes Personales (RG 5617) en pagos en pesos con tarjeta al exterior | **las notas se contradicen**: unas dicen que se elimino el 2/1/2026, otras que sigue. Hoy la cotizacion "tarjeta" de dolarapi.com (1.995,5) es exactamente el oficial (1.535) por 1,30 | prensa; indicio de mercado | **dudoso** |
| Impuesto PAIS | eliminado en diciembre de 2024 | prensa | prensa |

Se leyo hoy: [ARCA, envios postales y puerta a puerta](https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5829),
[Gobierno, arancel cero para celulares](https://www.argentina.gob.ar/noticias/ya-rige-el-arancel-cero-para-celulares-importados) y
[arancely.com, courier 2026](https://www.arancely.com/blog/regimen-courier-argentina-2026).

**Conclusion**: el esqueleto del calculo es firme (franquicia de USD 400, 5 envios, tope de USD 3.000), pero **los numeros que mas
pesan (derecho de importacion del excedente por rubro, IVA y percepciones) no tienen todavia una fuente oficial a la vista**. Por eso la
primera fase es verificar la normativa, y las reglas viven en un archivo con fuente y fecha, no en el codigo.

### 1.1 bis Referentes: como calculan y muestran el costo final (leido el 15/10/2026)

Se busco en la documentacion de las plataformas. **Amazon** (pagina de terminos de envio internacional, error 503) y **Tiendamia** (ayuda, 403 al abrirla con un cliente
automatico) no se pudieron leer enteras y **no se esquivo el bloqueo**: de ellas va solo lo que citan los resultados de busqueda, marcado como tal. eBay si se leyo completo.

| Referente | Como muestra el costo | Quien importa y cuando se paga | Que nos sirve | Nivel |
| --- | --- | --- | --- | --- |
| **Amazon (AmazonGlobal)** | En el checkout cobra un **«Import Fees Deposit»** (una estimacion de aranceles e impuestos) o un monto fijo («Import Charges») segun el pais | Un transportista actua como agente del comprador y despacha; si el deposito sobra, **reembolsa la diferencia**; si falta, **no cobra de mas**; los cargos fijos no se reembolsan | Mostrar una **estimacion con rango**, aclarar que la liquidacion real puede dar distinto y decir quien absorbe la diferencia. Las paginas leidas son genericas: ninguna da los montos para Argentina | prensa (citado por busqueda; pagina no abrio) |
| **eBay (International Shipping)** | El **«Import Fee»** del checkout puede incluir ventas, IVA, derechos, aranceles, impuestos internos, **honorarios de despacho de terceros y penalidades** | El comprador asume la importacion (secc. 3.1); si no lo paga al comprar, **puede cobrarse a la entrega** (5.e); el faltante despues de la entrega es del comprador (5.j); cobra un cargo por gestionar la **variacion entre lo cotizado y lo real** | Separar **tributos** de **honorarios del despachante** y decir **cuando** se paga (en el checkout o a la entrega). Argentina no figura en el texto leido | oficial (terminos de eBay, leidos) |
| **Tiendamia** | En el resumen de compra, un renglon **«Impuestos Prepagos y gestion aduanera»** | Por courier privado, **Tiendamia es el responsable tributario ante ARCA** y no hay que pagar nada despues; por Correo Argentino el comprador hace la declaracion simplificada y paga un **VEP** que incluye la «tasa de servicio y almacenaje» | Dos escenarios en la calculadora: **«lo gestiona el courier»** (todo prepago) y **«lo gestiono yo por Correo»** (VEP con tasa fija). Las paginas leidas por busqueda son viejas (hablan de 12 franquicias de USD 50 y de un 50% sobre el excedente, ya reemplazados por el Decreto 604/2026) y la tasa del Correo aparece como ARS 140, 260, 350 y 600 segun la pagina: **no se hardcodea, se pide como dato con su fecha** | prensa (citado por busqueda; 403) |
| **AliExpress, Temu, Shein** | Calculadoras de terceros: franquicia de USD 400, IVA del 21%, derechos y tasa solo sobre el excedente | Courier privado o Correo; ARCA publico precisiones para Shein y Temu (nota de iProfesional) | Los casos de uso mas comunes: **compras chicas de varias unidades**, donde pesa el **cupo de 5 envios** (ver el pendiente de la RG 5884) | prensa |
| **Mercado Libre (compras internacionales)** | Precio en pesos con el envio y los impuestos adentro (los 297 avisos con el sello `i` de nuestro indice) | Lo gestiona el vendedor o el courier | Es **lo que hay que comparar contra**: si el precio ya incluye impuestos, el desglose de K4 lo muestra; hoy no lo sabemos | por medir (K4) |
| **DHL, FedEx, UPS** | Cobran los tributos y sus **honorarios de despacho** («brokerage») aparte, a la entrega | El destinatario | Los **honorarios del courier** son un dato que cambia por empresa: ARCA no da montos | prensa |
| **Correo Argentino (puerta a puerta)** | VEP con tributos y **tasa de servicio y almacenaje** fija por paquete, sin importar el peso ni el valor | El comprador | Esa tasa se cobra aunque la compra sea chica y **no es parte de la franquicia** | oficial (ARCA, sin monto) |
| **Calculadoras privadas** (calculadoraimportacion.com.ar, calcusite, alidatos, servidos.ar, shippar.net) | Formulario con valor, envio y tipo de pago | n/a | Competencia directa de K3. **Se contradicen entre si** en el tratamiento de la percepcion del 30%: otra razon para marcar cada renglon con su fuente y su nivel | prensa |

**Que cambia en el diseño por esto** (se suma a K3):
- **Estimacion con rango y quien absorbe la diferencia**, como el deposito de Amazon: la calculadora da un valor y un rango, y dice que la liquidacion real puede variar.
- **Separar tributos de gestion**: tributos (oficiales, con fuente), **honorarios del courier o tasa del Correo** (dato que escribe la persona, con la fecha en que se consulto) y **percepciones** (escenario).
- **Cuando se paga**: «prepago en el checkout» o «a la entrega»; cambia el flujo de caja, no el total.
- **Escenario de canal**: «lo gestiona el courier» vs «lo gestiono yo por Correo Argentino (VEP)».
- **No se hardcodean montos que las plataformas no publican**: tasa del Correo y honorarios van como dato con fecha.

### 1.2 Monedas y cotizaciones

Probadas hoy con `curl` y un `Origin` de nuestro sitio. **Todas responden con `Access-Control-Allow-Origin: *`**, asi que el navegador puede
pedirlas directo, sin backend (principio I).

| Fuente | Que da | Frecuencia | Observaciones |
| --- | --- | --- | --- |
| [dolarapi.com](https://dolarapi.com/v1/dolares) | USD oficial, blue, bolsa (MEP), contado con liqui, mayorista, cripto y **tarjeta** (compra y venta); EUR, BRL, CLP y UYU contra el peso | minutos (cada tipo trae su `fechaActualizacion`) | open source (MIT), valores tomados de DolarHoy: es un agregador, no una fuente oficial |
| [BCRA, estadisticas cambiarias](https://api.bcra.gob.ar/estadisticascambiarias/v1.0/Cotizaciones) | cotizaciones oficiales de referencia de ~40 monedas | diaria | oficial, sin clave; limita por IP. No trae blue, MEP ni tarjeta |
| [open.er-api.com](https://open.er-api.com/v6/latest/USD) | 166 monedas contra una base | diaria (renueva cerca de medianoche UTC) | gratis con atribucion; cache de 1 hora |
| [frankfurter.dev](https://api.frankfurter.dev/v1/latest?base=USD) | ~30 monedas del BCE | diaria | sin clave |
| [argentinadatos](https://api.argentinadatos.com/v1/cotizaciones/dolares) | historico del dolar desde 2011 | diaria | 3 MB: solo para graficos, no para la calculadora |

**"Tiempo real" quiere decir "lo ultimo que publica cada fuente, con su hora a la vista"**: el dolar en pesos se mueve por minutos
(dolarapi) y las demas monedas por dia. La pagina siempre muestra de donde sale y cuando se actualizo (principio II).

### 1.3 Lo que ya tenemos en el indice

- Precio en pesos de cada aviso, tienda y fecha; 297 avisos con el sello `i` (compra internacional), todos de Mercado Libre via
  ComparaYa. **No** hay peso, posicion arancelaria, origen ni precio en dolares.
- La comparativa curada ya calcula "puesto en Mendoza" con el envio adentro; es la unica que muestra un costo mas alla del precio.

## 2. Principios de este plan

- **Reglas como datos** (principio II): `importacion.json` (el archivo ya previsto en el plan v2) con cada regla, su valor, su fuente
  oficial, desde cuando rige y cuando se verifico por ultima vez. Lo que no se pudo verificar **no se inventa**: se muestra como "no
  incluido" con la nota de por que.
- **Nada de asesoramiento**: la calculadora estima; la pagina lo dice. Cuando una regla sea dudosa, el desglose lo marca y suma o resta
  solo en el escenario que la persona elija.
- **Estatico** (principio I): el calculo corre en el navegador. Las cotizaciones se piden en vivo y hay una copia del ultimo valor
  conocido escrita en el build, para que la calculadora funcione sin red y la pagina no quede en blanco si una API cae.
- **TDD con casos oficiales** (principio IV): los ejemplos publicados por ARCA y por el estudio (USD 200, 300 y 800) son tests.
- **Medir antes de crecer** (principio V): desde la primera version, un evento sin cookies cuando se usa la calculadora, y cuando se
  copia o comparte un desglose. Si no se usa, no se sigue invirtiendo.
- **Respeto a las fuentes** (principio III): un pedido por visita a cada API, con cache en memoria y tiempo maximo de espera; si una API
  limita o bloquea, se usa la siguiente o la copia del build. Nunca se esquiva un limite.

## 3. Diseño

- **`importacion.json`**: reglas versionadas. Cada una con `valor`, `fuente` (URL oficial), `rige_desde`, `verificado` (fecha) y `nivel`
  (`oficial`, `prensa`, `dudoso`). Ejemplo: `{"franquicia_usd": {"valor": 400, "fuente": "https://servicioscf.afip.gob.ar/...", "rige_desde": "2026-07-30", "verificado": "2026-10-15", "nivel": "oficial"}}`.
  Si una regla pasa 60 dias sin verificar, la pagina lo avisa y la CI lo senala.
- **`js/costos.js`**: motor puro (sin DOM), con tests. Entra el precio del producto y su moneda, flete, seguro, rubro, canal (courier,
  Correo, compra local) y medio de pago; sale un **desglose por renglon** (concepto, base, alicuota, monto, regla que lo explica y su
  nivel de confianza) y el total, en dolares y en pesos.
- **`js/monedas.js`**: conversion entre monedas con la cotizacion elegida; pide dolarapi y las demas fuentes, cae a `cotizaciones.json`
  (copia del build, escrita por `generar_cotizaciones.py` en la Action de actualizacion) y avisa "cotizacion de hace 3 h" o "sin
  conexion: ultima conocida del 14/10".
- **Selector de monedas global**: pesos (por defecto), dolar (oficial, blue, MEP, contado con liqui, tarjeta), euro, real, yuan, libra y
  otras de open.er-api. Se recuerda en `localStorage` (comodidad de cada persona, nunca algo que deba persistir).
- **CSP**: `connect-src` suma `https://dolarapi.com` y la fuente de las demas monedas, justificado en el PR (regla de `CONSTRAINTS.md`).
- **UI**: una vista "Costo" (calculadora) con el desglose, el selector de moneda y un enlace para compartir el calculo (`?costo=...`);
  mas adelante, el mismo desglose dentro de cada aviso internacional.

## 4. Que entra en el desglose

| Concepto | Se calcula con | Estado |
| --- | --- | --- |
| Precio del producto (FOB) | el que escribe la persona, en la moneda elegida | siempre |
| Flete internacional y seguro | lo que escribe la persona (a veces ya van en el precio) | siempre |
| Derecho de importacion | por posicion arancelaria del rubro, solo sobre el excedente de la franquicia | K0: por rubro, a verificar |
| Tasa de estadistica | porcentaje sobre el excedente | K0 |
| IVA | 21% (o 10,5% segun el bien) sobre FOB mas derechos y tasa | K0 |
| Impuestos internos | celulares, TV, monitores: segun la tabla vigente | K0 |
| Percepciones (IVA y Ganancias) | segun el canal y el medio de pago | **dudoso: opcional, con nota** |
| Honorarios del courier / gestion | lo que escribe la persona (la prensa no da un numero firme) | siempre |
| Costo de recibirlo (envio dentro del pais) | tabla por zona o lo que escribe la persona | K3 |
| Tipo de cambio | el elegido (oficial, MEP, tarjeta...) | K2 |
| Comparacion con comprar aca | el precio local verificado del indice, mismo modelo | K4 |

## 5. Fases

Cada fase va en su propia sesion de Claude Code, con spec-kit para el que, Superpowers y TDD para el como, y merge con la CI en
verde. Se pueden hacer en paralelo K1 y K2 (archivos distintos).

### K0. Normativa verificada (semana 1; dueño y Claude)

- Verificar contra el Boletin Oficial y las paginas de ARCA, una por una, las filas **prensa** y **dudoso** de 1.1: IVA y percepcion del
  courier, derecho de importacion y tasa del excedente (por rubro: placas, memorias, SSD, notebooks, celulares, monitores, TV, audio),
  impuestos internos, percepciones de Ganancias y de IVA, y si sigue un 50% plano para lo que pasa los topes.
- Escribir `importacion.json` v1 y `specs/010-costos/spec.md` (con spec-kit) con una tabla "regla, fuente, fecha, nivel".
- **Dueño**: confirmar con un contador o un despachante las que sigan dudosas (percepciones, impuestos internos). Lo que no se confirme
  entra como "no incluido, ver nota".

Sale cuando: cada regla del calculo tiene fuente oficial y fecha, o esta marcada como no incluida.

**Hecha el 15/10/2026**: `importacion.json` v1 (26 reglas: 16 oficiales, 8 pendientes, 1 de prensa y 1 dudosa) y `specs/010-costos/spec.md`; `tests/test_importacion.py` exige fuente oficial y fecha. Queda para el dueño confirmar con un contador o despachante la lista de pendientes de la spec.

### K1. Motor de calculo (semana 2; TDD)

- `js/costos.js` y `tests/js/costos.test.js`: los ejemplos de ARCA (USD 200 y 300 dentro de la franquicia, USD 800 con excedente), el
  limite de 5 envios, el tope de USD 3.000, las 3 unidades, los redondeos y el desglose renglon por renglon.
- Ningun numero de normativa en el codigo: todo sale de `importacion.json` (un test lo exige).

Sale cuando: los casos oficiales dan al centavo y cambiar una regla no toca el codigo.

**Hecha el 15/10/2026**: `js/costos.js` y `tests/js/costos.test.js` (24 tests): los 4 casos de referencia de la spec 010 dan al centavo, la franquicia, el cupo, el tope, las 3 unidades y los 50 kg, los pendientes quedan como «no incluido», el flete en la base como escenario, la percepcion aparte y el **rango segun el medio de pago** (`medioPago`); ningun numero de normativa esta en el codigo y un test lo exige. Se verifico con tres mutaciones del codigo y con una segunda revision de Claude por OmniRoute, que encontro un bug real en el rango (corregido con su test). Todavia no se carga en `index.html`: eso es K3.

### K2. Monedas en vivo (semana 2; en paralelo con K1)

- `js/monedas.js`, `generar_cotizaciones.py` (copia del build) y el cambio de CSP.
- Selector de moneda, hora de cada cotizacion, aviso de cotizacion vieja o sin conexion.
- Tests con respuestas guardadas de cada API (nunca contra la red) y con cada API caida.

Sale cuando: la pagina convierte con la ultima cotizacion disponible, dice cuando es, y funciona sin red.

### K3. Calculadora en la app (semanas 3-4)

- Vista "Costo": formulario, desglose con confianza de cada renglon, escenarios (con o sin percepcion, courier o Correo), enlace para
  compartir y evento de uso.
- Accesible (teclado, lector de pantalla), con contraste AA en claro y oscuro y Lighthouse movil >= 90; capturas en el PR.

Sale cuando: una persona calcula un costo puesto en casa en menos de un minuto y lo comparte.

### K4. Del aviso al costo real (semanas 5-6; une con la Fase C del plan v2)

- Desglose dentro de cada aviso internacional del indice (los 297 de Mercado Libre): precio en pesos, de donde sale y que impuestos
  lleva o le faltan, **solo si K0 y la medicion de esos avisos lo permiten** (hoy no sabemos si su precio ya incluye impuestos).
- Comparar contra el mejor precio local verificado del mismo modelo (codigo de modelo): "conviene aca", "conviene importar" o "da lo
  mismo". Necesita el precio del exterior (C2 del plan v2).

Sale cuando: 50 productos con el veredicto "aca o importar" y la regla de cada renglon visible.

### K5. Mantenimiento de la normativa (permanente)

- La CI avisa cuando una regla pasa 60 dias sin verificar; un issue mensual con la lista para revisar contra ARCA.
- Cada cambio de norma entra por un PR a `importacion.json` con la fuente y la fecha, y los tests lo cubren.

## 6. Riesgos y decisiones abiertas

| Riesgo o decision | Que hacemos |
| --- | --- |
| Las reglas cambian seguido (hubo cambios en enero y julio de 2026) | reglas como datos, fecha de verificacion a la vista y aviso a los 60 dias |
| Un calculo mal puede dar una falsa seguridad | nivel de confianza por renglon, escenarios y el texto "estimacion, no asesoramiento"; lo dudoso no se suma sin avisar |
| Las APIs de cotizacion son de terceros (dolarapi es un agregador) | fuente a la vista, copia del build y segunda fuente; si una limita, se usa la siguiente |
| "Tiempo real" no es literal para todas las monedas | se muestra la hora real de cada cotizacion |
| Decision del dueño: que tipo de dolar es el de **por defecto** (oficial, MEP o tarjeta) | se propone tarjeta para compras con tarjeta y oficial para el resto, con selector |
| Decision del dueño: confirmar percepciones con un contador | K0 |
| Que rubros entran primero | los que ya tenemos (RAM, SSD, placas) y celulares (arancel 0%); el resto con la Fase B5 |

## 7. Que hace cada uno

| Dueño (necesita tu decision o tus cuentas) | Claude Code |
| --- | --- |
| Confirmar con un contador o despachante las reglas dudosas | Verificar contra ARCA y el Boletin Oficial, escribir `importacion.json` y la spec |
| Elegir el tipo de dolar por defecto y los rubros iniciales | Motor, monedas, UI, tests y CSP |
| Aprobar el texto legal de "estimacion, no asesoramiento" | Redactar el texto y mostrarlo en la pagina |
| Decidir si se agrega un correo o un canal para avisar cambios de norma | Issue mensual y aviso en la CI |

## 8. Orden de ejecucion

1. K0 (sin esto el resto calcula con numeros dudosos).
2. K1 y K2 en paralelo, en sesiones separadas.
3. K3 cuando K1 y K2 esten mergeados.
4. K4 junto con la Fase C del plan v2, cuando haya precio del exterior (C2) y identidad por codigo de modelo.
5. K5 desde el dia uno de la primera version publicada.

Gatillo para frenar: si a los 60 dias de publicada la calculadora casi no se usa, se pasa a distribucion (plan v2, seccion 3) en lugar de seguir sumando.
