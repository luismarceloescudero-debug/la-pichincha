# Investigación de tiendas de apps (fase 2, 12/11/2026)

Fase 2 de `docs/plan-v4-tiendas-de-apps.md`: antes de escribir la ficha de Google Play hay que saber **qué ofrecen
los rivales, qué piden sus usuarios y con qué palabras se busca**. La métrica que manda sigue siendo la de todo el
plan: clics salientes a tiendas por semana.

Todo lo que sigue se midió el **12/11/2026** salvo que diga otra fecha. Lo que no se pudo medir está en la sección 1
con el motivo: nada se completa «a ojo» y nada se esquivó (constitución, principio III).

---

## 1. Cómo se midió (y qué no se pudo ver)

| Fuente | Cómo | Resultado |
|---|---|---|
| Fichas de Google Play | Lectura de la página pública con un lector de texto (`r.jina.ai`), `hl=es`, `gl=AR` | Ficha, descripción, puntaje, reseñas y descargas de 5 apps (sección 2) |
| Búsqueda de Google Play | `play.google.com/store/search?q=…&c=apps&gl=AR` | Qué apps compiten por «comparador de precios argentina» y «precio placa de video» |
| Sugerencias de búsqueda | `suggestqueries.google.com` con `hl=es&gl=ar` | Palabras reales de la gente (sección 5) |
| Sitio del rival | `comparaya.net` | Tiendas, productos y funciones que declara |
| Search Console | **No se pudo**: pide la cuenta del dueño | Queda pendiente: las consultas que ya traen gente a `/precios/` |
| GoatCounter | **No se pudo**: el panel pide usuario y la API, un token | Queda pendiente, sobre todo las búsquedas con `busqueda_vacia` |
| `media/app_suggest` de Play (sugerencias dentro de la tienda) | **No se pudo**: el endpoint interno devuelve 404 hoy | Se usaron las de Google, que son las mismas palabras que escribe la gente |
| Reseñas de ComparaYa y de Rondo | **No se pudo**: sus fichas no publican ninguna todavía | Se anota «sin reseñas públicas», no se inventa |
| Reddit `r/DescuentosArgentina` | **No se pudo**: 403 del lector, pide sesión | Se mide cuando el dueño pase el enlace de la conversación |

---

## 2. Fichas medidas el 12/11/2026

| App | Paquete | Puntaje | Reseñas | Descargas | Última actualización | Qué hace |
|---|---|---|---|---|---|---|
| **Precialo** | [`ar.com.precialo.www.twa`](https://play.google.com/store/apps/details?id=ar.com.precialo.www.twa) | 4,0 | 12 | 1 mil+ | 11/11/2026 | Buscador y comparador general: más de 80 tiendas, historial, alertas, favoritos y reseñas de productos. Es una **TWA**: envuelve su propio sitio, el mismo camino que elegimos en 3.1. Desarrollador: Precialo SAS (Argentina) |
| **ComparaYa** | [`net.comparaya.app`](https://play.google.com/store/apps/details?id=net.comparaya.app) | sin puntaje público | sin reseñas públicas | 1 mil+ | 28/10/2026 | El rival más parecido. Su sitio declara 106 tiendas y 669.000 productos (la ficha de Play dice «más de 70 tiendas»: sus propios números no coinciden); historial con gráfico, alertas por correo y notificación, filtros por tienda, precio, descuento y cuotas, y un carrito que arma la compra en una o dos tiendas. Desarrollador: Valentino Formento (Argentina) |
| **Geizhals** | [`at.geizhals.pv`](https://play.google.com/store/apps/details?id=at.geizhals.pv) | 4,6 | 6.190 (la sección de reseñas dice 5.720) | 1 M+ | 22/10/2026 | La referencia mundial del rubro (Austria, Alemania, Polonia, Reino Unido): historial de precios, alarma de precio, listas, modo oscuro y escáner de códigos. Desarrollador: Preisvergleich Internet Services AG |
| **Rondo** | [`com.danielappdaniel.elmejorprecionuevo`](https://play.google.com/store/apps/details?id=com.danielappdaniel.elmejorprecionuevo) | sin puntaje público | sin reseñas públicas | 500+ | 27/09/2026 | Comparador «de barrio» por geolocalización: qué comercio cerca tiene el producto, a qué precio y a qué distancia. Se promociona en Instagram y Facebook, como dice el plan. Desarrollador: Martines Luis Daniel (Argentina) |
| **PromoDescuentos** | [`com.tippingcanoe.promodescuentos`](https://play.google.com/store/apps/details?id=com.tippingcanoe.promodescuentos) | 4,5 | 54 mil | 1 M+ | 26/10/2026 | Comunidad de ofertas (México): la gente publica, vota y comenta; alertas por palabra clave. Se mide como referencia del formato comunitario, no como rival argentino. Desarrollador: Atolls |

**Contexto de la tienda** (búsqueda del 12/11/2026):

- Por «comparador de precios argentina» aparecen Precialo, ComparaYa, PrecioYa, SuperJusto, Pricely, Mirá Precios,
  Reprice, Buscaprecios, PriceNotify, idealo, PromoDescuentos y Mercado Libre. Ninguna es de hardware.
- Por «precio placa de video» aparecen Portátil barato, GPU-L, Kotta, PriceSpy, Reprice y Mercado Libre. **No hay una
  app argentina de precios de hardware**: el nicho está libre y la ficha se puede quedar con esas palabras.

---

## 3. Lo que dicen las reseñas

| Rival | Lo que valoran | Lo que les molesta | Qué tomamos |
|---|---|---|---|
| Geizhals | «El diseño me gusta mucho más [que idealo] y no se traba» (noviembre 2026); «la mejor app de comparación que hay» | Del rediseño de 2022: «las listas locales desaparecieron», «solo se puede elegir una región», «la letra es demasiado chica y casi no se lee», «más lenta», y las ofertas con envío desconocido quedaban afuera | Listas que **no se pierdan** al actualizar; tipografía legible y objetivos táctiles grandes (Play los mide); mostrar el envío aunque falte el dato, en vez de esconder la oferta; velocidad como función |
| Precialo | «Es mi buscador de productos por defecto» (21/10/2026); «hiper funcional y liviana»; varios esperaban la app después de usar la web | Nada repetido: son pocas reseñas y todas buenas; piden más tiendas | Que la app llegue **después** de que la web sirva: la instalación se pide a quien ya la usa |
| PromoDescuentos | «Excelente información»; la comunidad corrige y vota | Desconfianza en las ofertas publicadas por comercios («este pseudo-negocio compra todo y sube el remanente»), moderación y baneos sin aviso; un usuario recomienda Keepa | Nuestro ángulo: la baja se mide **contra el historial propio**, no contra el precio tachado (constitución, principio II) |
| ComparaYa y Rondo | Sin reseñas públicas todavía | — | Se vuelven a mirar cuando junten valoraciones |

**Las tres cosas que los usuarios piden, en orden** (y que van primero en la ficha y en la app): **alerta de precio**,
**historial que muestre si la oferta es real** y **comparar el mismo modelo entre tiendas**. La cuarta, que aparece en
las quejas: **que sea liviana y no se trabe**.

---

## 4. La Pichincha contra los rivales

| Función | Precialo | ComparaYa | Geizhals | La Pichincha hoy |
|---|---|---|---|---|
| Comparar el mismo modelo entre tiendas | Sí | Sí | Sí | **Sí** (eje del buscador) |
| Historial de precios | Sí | Sí | Sí | **Sí** (rama `historial`, series por producto) |
| Alerta de precio | Sí | Sí (correo y notificación) | Sí (correo) | **No**: es la sección 3.4 del plan |
| Filtros por especificación | Parcial | Por tienda, precio, descuento y cuotas | Muy completos | **Sí** (capacidad, condición, envío, cuotas) |
| Costo final (envío e importación) | Parcial | Cuotas, no importación | Envío | **Sí** (cargos de importación de Tiendamia) |
| Oferta medida contra historial propio | No declara | No declara | Sí, por tendencia | **Sí** (15% a 60%, contra el historial) |
| Favoritos | Sí | Sí | Sí | **No** |
| Requiere cuenta | No | No | No | **No** (ni la va a requerir: la suscripción push es la identidad) |
| App en Play | Sí (TWA) | Sí | Sí | **No todavía** (fase 3) |
| Especialización en hardware | No | No | No (general) | **Sí**, es el diferencial |

Lectura: no competimos por cantidad de tiendas ni por surtido general (ahí ganan ComparaYa y Precialo). Competimos por
**hardware, precio verificado y oferta honesta**, y lo que falta para no quedar atrás en la ficha son las **alertas**
(sección 3.4) y los **favoritos**.

---

## 5. Palabras de búsqueda (ASO)

Sugerencias medidas el 12/11/2026 con `hl=es&gl=ar` (autocompletar de Google; las de Play no se pudieron consultar,
ver sección 1):

| Semilla | Sugerencias que devolvió |
|---|---|
| comparador de precios | comparador de precios **argentina**, de precios supermercados, **componentes pc**, electrodomesticos, **hardware**, pc, de vuelos |
| precio placa de video | precio placa de video para pc, nvidia, 4060, **argentina** |
| donde comprar placa de video | **argentina**, usada, reddit, en amazon argentina |
| precio rtx 5070 | rtx 5070 ti, 12gb, ti 16gb |
| historial de precios | **argentina**, mercado libre, de un producto, steam, ps store |
| alerta de precio | vuelos, google flights, amazon, mercado libre, binance (dominado por vuelos y cripto: **no sirve sola**) |
| ofertas hardware | pc, **telegram**, whatsapp, grupo de ofertas hardware, canal de ofertas hardware |

Lo que dicen estos datos:

1. **«comparador de precios argentina»** y **«componentes pc» / «hardware»** son la misma búsqueda con la intención
   correcta: la palabra «comparador de precios» tiene que estar en la ficha, no solo «hardware».
2. La gente busca **el producto**, no la categoría («precio rtx 5070», «precio placa de video nvidia»). La ficha larga
   tiene que nombrar modelos reales.
3. **«Historial de precios»** y **«alerta de precio»** se buscan solos, y «alerta de precio» viene contaminada por
   vuelos y cripto: conviene acompañarla siempre de «hardware» o del producto.
4. **«Ofertas hardware» vive en Telegram** (whatsapp, grupo, canal). Confirma la sección 8 del plan: el canal de
   Telegram es el lugar donde está la gente que compra hardware, y por eso es también de donde salen los probadores.

**Palabras elegidas para la ficha:** `comparador de precios`, `historial de precios`, `alerta de precio`,
`placa de video` y `ofertas hardware`. Cada una aparece al menos una vez en la descripción larga y ninguna más de tres
veces: Play castiga el relleno. El test `tests/test_investigacion_tiendas.py` lo verifica.

---

## 6. Propuesta para la ficha de Play

La fase 3 toma estos textos tal cual para `app-android/twa-manifest.json`. Los topes de Play son 30 caracteres de
título, 80 de descripción corta y 4.000 de descripción larga; el test los mide. Como quedaron el 12/11/2026:
**título 30/30**, **corta 72/80**, **larga 2.644/4.000** (hay margen para sumar capturas y preguntas frecuentes).

```json-propuesta
{
  "titulo": "Pichincha: precios de hardware",
  "corta": "Comparador de precios de hardware en Argentina, con alertas cuando baja.",
  "palabras": ["comparador de precios", "historial de precios", "alerta de precio", "placa de video", "ofertas hardware"],
  "larga": [
    "La Pichincha es un comparador de precios de hardware en Argentina. Reúne en un solo lugar lo que ofrecen más de veinte tiendas de componentes y periféricos —placas de video, procesadores, memorias, discos, fuentes, gabinetes y monitores— y te dice cuánto sale cada cosa, en qué tienda y desde cuándo está a ese precio.",
    "",
    "La diferencia con otros buscadores es simple: cada precio muestra de dónde sale y a qué hora se verificó. Si una tienda publica un descuento, se mide contra el historial propio y no contra el precio tachado: una baja cuenta solo si está entre el 15% y el 60% y si el precio de hoy es realmente más bajo que el de los días anteriores.",
    "",
    "QUÉ PODÉS HACER",
    "• Buscar el modelo exacto —«rtx 5070», «ryzen 5 7600», «ssd 1 tb»— y comparar el mismo modelo contra el mismo modelo, no contra uno parecido.",
    "• Mirar el historial de precios de cada producto para saber si la oferta es real o si el precio viene alto desde hace semanas.",
    "• Crear una alerta de precio: elegís el producto y el precio que te parece justo, y te avisamos cuando baja.",
    "• Ver el costo final: precio del producto, envío y, en las compras internacionales, los cargos de importación estimados.",
    "• Leer la ficha técnica de cada modelo (memoria, frecuencia, consumo, conectores) para no comparar cosas distintas.",
    "",
    "PARA QUIÉN ES",
    "Para quien arma o mejora una PC y no quiere abrir ocho pestañas por componente; para quien sigue el precio de una placa de video durante meses esperando el momento; para quien compra para un negocio y necesita el mismo dato, repetible y con fecha.",
    "",
    "CÓMO SE MANTIENE HONESTO",
    "• El orden de los resultados nunca depende de una comisión, y todo enlace de afiliado está rotulado.",
    "• Si una tienda no se pudo leer, se informa: no se muestran precios viejos como si fueran de hoy.",
    "• No hay cuentas ni contraseñas, y la analítica es sin cookies: no se guardan datos personales.",
    "• Se releva una vez por día y con pausas; si una tienda bloquea el acceso, se respeta y se avisa, no se esquiva.",
    "",
    "OFERTAS HARDWARE TODOS LOS DÍAS",
    "Además del buscador hay una página con las bajas del día y un canal de ofertas hardware en Telegram, para quien prefiere que el aviso le llegue en vez de andar buscando.",
    "",
    "SOBRE LAS TIENDAS",
    "Se compara lo que se puede verificar: productos nuevos, del mismo modelo y con stock. Lo que no es comparable —usados, equipos armados, accesorios sueltos, publicaciones «similares»— se separa y se dice cuánto quedó afuera.",
    "",
    "CONTACTO",
    "contacto@pichinchadeldia.com.ar — La Pichincha es un proyecto independiente, hecho en Argentina. Los precios son informativos y pueden cambiar en la tienda: el precio válido es el del momento de la compra."
  ]
}
```

Notas para la fase 3:

- El nombre que queda en el teléfono es **«Pichincha»** (coincide con `short_name` del manifiesto). Si el dueño quiere
  «La Pichincha» completo, el título pasa a «La Pichincha: precios hardware», que también entra en 30.
- La ficha **no promete alertas como si ya estuvieran**: se publica cuando la sección 3.4 esté andando. Si Play pide
  lanzar antes, se saca el punto de la alerta de la descripción; no se deja una promesa que la app no cumple.
- El correo de contacto tiene que existir antes de enviar la ficha (sección 5 del plan).

---

## 7. Encuesta a la gente (borrador)

Tres preguntas, para el canal de Telegram y para `/hoy/` (la fase de promoción decide dónde y cuándo; acá queda el
texto). Se pide que contesten por privado, sin datos personales en el canal.

1. ¿Qué compraste de hardware en los últimos tres meses y dónde buscaste el precio?
2. ¿Qué te hizo elegir esa tienda por sobre otra: precio, cuotas, envío o confianza?
3. ¿Qué te haría instalar una app de precios en el teléfono?

A quien conteste las tres se le ofrece ser **probador de la prueba cerrada** de Play (sección 4 del plan: 12 personas,
14 días, con 20 pedidas para tener margen). Las 5 charlas cortas de la sección 2.3 salen de esas respuestas.

---

## 8. Qué sigue

1. **Search Console** (dueño): exportar las consultas que traen gente a `/precios/` y sumarlas a la sección 5. Las
   palabras de la ficha se ajustan con esos datos, no con los de Google a secas.
2. **GoatCounter** (dueño o token): las búsquedas con `busqueda_vacia` dicen qué productos pide la gente y no tenemos.
3. **Reseñas de Play**: cuando la app exista, la API de reseñas trae las de 1 y 2 estrellas todos los días (sección 7.1
   del plan) y ahí sí se mide qué molesta de verdad.
4. **Ronda de la encuesta** y 5 charlas: alimentan los primeros 12 probadores.
5. **Repetir esta medición** cuando alguna ficha cambie de puntaje o cuando aparezca un comparador argentino nuevo.
