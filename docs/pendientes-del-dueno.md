# Pendientes que dependen de vos

Última revisión: 24/10/2026. Cada ítem dice **qué se destraba**, el **paso a paso**, los **enlaces** (revisados el
24/10 desde el entorno de trabajo: los que piden iniciar sesión o tienen anti-bots están marcados) y, cuando hay que
escribirle a alguien, el **mensaje ya armado**. Entre `[CORCHETES]` va lo que tenés que completar vos.

Ningún mensaje dice cifras de visitas ni de ventas que el sitio no tenga medidas.

| # | Pendiente | Qué se destraba | Tiempo |
|---|---|---|---|
| 1 | Un contacto público | `security.txt` y la página «Acerca de» (confianza para Google y para quien compra) | 5 min |
| 2 | Escribir a FullH4rd, Katech, Compra Cierta y Loquieroacá | Cuatro tiendas que hoy no entran al índice o a «Afuera» | 15 min |
| 3 | eBay (claves y afiliados) | «Afuera» con eBay: precios en vivo y comisión | 30 min + espera |
| 4 | AliExpress (claves y afiliados) | «Afuera» con AliExpress, y comisión | 30 min + espera |
| 5 | Mercado Libre: confirmar clics | Saber si el link de afiliado cuenta | 2 min |
| 6 | Google Search Console | Que Google lea el mapa del sitio y avise de errores | 10 min |
| 7 | Contador o despachante | Las 8 reglas de importación marcadas «pendiente» | una consulta |
| 8 | OmniRoute: reconectar Claude | Un respaldo más para las revisiones | 2 min |
| 9 | Amazon (más adelante) | Amazon en «Afuera» | cuando haya 10 ventas |
| 10 | Instagram (separado, en pausa) | Publicar la tarjeta del día | cuando lo retomes |

---

## 1. Un contacto público

**Qué decidir:** qué dirección ponemos en `/.well-known/security.txt` y en «Acerca de». No publico tu email sin que lo
elijas.

**Opciones** (de más a menos recomendada):

1. Una dirección nueva solo para el sitio (por ejemplo `hola@` en tu dominio, o una cuenta gratis aparte). Si un día
   recibe spam, se cambia sin tocar tu correo personal.
2. Tu correo actual.
3. Un formulario (Google Forms). El `security.txt` acepta un enlace en lugar de un correo.

**Paso a paso:** elegí una opción y mandame la dirección o el enlace; con eso dejo `security.txt` (con vencimiento a un
año) y «Acerca de» listos en un solo PR. Para «Acerca de» también me sirve que me cuentes en dos o tres frases quién
hace el sitio y por qué (es lo que Google llama E-E-A-T: que se vea una persona real detrás).

---

## 2. Tiendas que no entran

Regla del proyecto: **no se esquivan anti-bots, captchas ni bloqueos**. La salida legítima es pedirles un feed, una API
o que dejen pasar al indexador. Lo que se midió el 24/10:

| Tienda | Qué pasa | Desde cuándo |
|---|---|---|
| FullH4rd | 0 productos en GitHub; su sitio da 403 también desde el entorno de trabajo | 8/10 (issue #6) |
| Katech | **Desde el entorno de trabajo trae 2.552 productos; desde GitHub, 0.** Bloquea las IP de los servidores de GitHub | siempre (issue #55) |
| Compra Cierta | 0 productos (traía 27); desde el entorno de trabajo el dominio ni resuelve | 20/10 (issue #96) |
| Loquieroacá | 403 en «Afuera» | siempre |

**Paso a paso:**

1. Abrí el sitio de cada una y buscá «Contacto», «Mayoristas» o «Revendedores» en el pie de página. Anotá el correo o
   WhatsApp que figure. Ya verificado: Katech publica `ventas@katech.com.ar` y WhatsApp +54 9 11 3383-0278
   (https://katech.com.ar/ayuda/ responde bien). Para las otras tres no pude leer el sitio (403 o sin respuesta), así
   que **el contacto lo tenés que sacar vos**.
2. Mandá el mensaje de abajo.
3. Si en dos semanas no contestan, me avisás y las damos de baja del índice (queda el aviso en `/estado/`).

Enlaces: https://fullh4rd.com.ar/ · https://katech.com.ar/ · https://www.compracierta.com.ar/ ·
https://www.loquieroaca.com/ (FullH4rd y Loquieroacá dan 403 a programas automáticos: abrilos desde el navegador).

### Mensaje para las tiendas (correo o WhatsApp)

> **Asunto:** Propuesta: sumar [NOMBRE DE LA TIENDA] a La Pichincha (comparador de precios de hardware)
>
> Hola, ¿cómo están? Soy [TU NOMBRE] y armé La Pichincha (https://pichinchadeldia.com.ar), un comparador gratuito de
> precios de hardware en Argentina. Muestra el precio de cada tienda con el link directo a su producto, y la compra se
> hace siempre en el sitio de la tienda.
>
> Quiero que [NOMBRE DE LA TIENDA] aparezca con sus precios al día, pero nuestro sistema hoy no puede leer su catálogo
> [FullH4rd / Loquieroacá: porque su sitio rechaza las consultas automáticas · Katech: porque su sitio rechaza las
> consultas desde los servidores que usamos · Compra Cierta: porque su sitio no respondió en las últimas consultas].
> No queremos saltear ninguna protección, por eso les escribo.
>
> ¿Podrían ayudarnos con alguna de estas opciones?
> 1. Un feed de productos y precios (CSV, XML o JSON) o el acceso a una API.
> 2. Autorizar nuestras consultas (por ejemplo, habilitando nuestro acceso en su protección).
> 3. Si prefieren, un programa de afiliados o referidos, para que cada visita que les llevamos quede registrada.
>
> Para ustedes no tiene costo y no cambia nada en su sitio. Si les sirve, les mando cómo se ve su producto en La
> Pichincha. Quedo atento, gracias.
>
> [TU NOMBRE] · [TU CONTACTO]

Una versión corta para WhatsApp:

> Hola, soy [TU NOMBRE], de La Pichincha (pichinchadeldia.com.ar), un comparador gratis de precios de hardware. Quiero
> sumar a [NOMBRE DE LA TIENDA] con sus precios al día, pero nuestro sistema no puede leer su catálogo. ¿Tienen un feed
> o una API, o pueden autorizar nuestras consultas? No cambia nada en su sitio y la compra se hace en el de ustedes.
> Gracias.

---

## 3. eBay

**Qué se destraba:** «Afuera» busca en eBay en vivo con envío a Argentina, y los links pueden llevar tu código de
afiliado. El código ya está hecho y probado con respuestas de ejemplo; **falta que lo pruebes con claves reales**.

**Paso a paso:**

1. Creá la cuenta de desarrollador: https://developer.ebay.com/ (da 403 a programas automáticos; en el navegador abre).
2. En «Application Keys» (https://developer.ebay.com/my/keys, pide iniciar sesión) generá el **keyset de Production**.
   Copiá `App ID (Client ID)` y `Cert ID (Client Secret)`.
3. Afiliados: https://partnernetwork.ebay.com/ (abre bien) → «Join now» (https://partnernetwork.ebay.com/page/join).
   Cuando te aprueben, creá una campaña y copiá su número (`Campaign ID`). Es opcional: sin él, Afuera anda sin comisión.
4. Cargá los secretos en el repo: **Settings → Secrets and variables → Actions → New repository secret**
   (https://github.com/luismarceloescudero-debug/la-pichincha/settings/secrets/actions, pide iniciar sesión).
   Guía de GitHub: https://docs.github.com/es/actions/security-guides/using-secrets-in-github-actions

   | Nombre | Valor |
   |---|---|
   | `EBAY_CLIENT_ID` | el App ID de Production |
   | `EBAY_CLIENT_SECRET` | el Cert ID de Production |
   | `EBAY_CAMPAIGN_ID` | (opcional) el número de campaña |

5. Avisame: el Worker se redespliega con el próximo cambio en `worker/`, y yo pruebo una búsqueda real.
6. **Si `/buscar` dice `ebay: HTTP 401`** (pasó el 25/10, con las claves ya cargadas): casi seguro el keyset de Production
   figura **deshabilitado («Non Compliant»)** hasta resolver el requisito *Marketplace Account Deletion*. Dentro de
   «Application Keys», en el keyset de Production, completá una de las dos opciones que muestra el cartel: suscribirte a
   las notificaciones, o **optar por la exención** (el sitio no guarda datos de usuarios de eBay). Al completarla el
   keyset se activa solo; según los foros de eBay a veces la exención tarda. Comprobá también que las claves sean las de
   **Production** (los identificadores de Production llevan `PRD`, los de Sandbox `SBX`) y que se hayan pegado sin
   espacios. Después me avisás y repito la búsqueda.

No me pases las claves por acá: van solo en los secretos de GitHub.

---

## 4. AliExpress

**Qué se destraba:** lo mismo que eBay, con AliExpress (precios en dólares, con envío a Argentina).

**Paso a paso:**

1. Programa de afiliados: https://portals.aliexpress.com/ (abre) → registrate y esperá la aprobación. Ahí sale tu
   **Tracking ID**.
2. Plataforma para desarrolladores: https://openservice.aliexpress.com/ (abre) → creá una aplicación del tipo
   «Affiliate / API» y pedí el permiso de «Affiliate». Copiá `App Key` y `App Secret`.
3. Cargá los secretos (mismo lugar que en eBay):

   | Nombre | Valor |
   |---|---|
   | `ALIEXPRESS_APP_KEY` | la App Key |
   | `ALIEXPRESS_APP_SECRET` | el App Secret |
   | `ALIEXPRESS_TRACKING_ID` | el Tracking ID |

4. Avisame y lo pruebo.

---

## 5. Mercado Libre: confirmar que cuenta los clics (2 minutos)

El link de afiliado ya sale en `/hoy/`, en Telegram y en el feed (spec 027). Falta saber si Mercado Libre lo registra.

1. Abrí desde tu celular un link de Mercado Libre de https://pichinchadeldia.com.ar/hoy/ (que sea uno marcado como
   afiliado).
2. Entrá a la central de afiliados: https://www.mercadolibre.com.ar/afiliados (pide iniciar sesión).
3. Mirá **«Clics»**. Puede tardar unas horas en aparecer. Si a las 24 h no cuenta, avisame y reviso el formato del link.

---

## 6. Google Search Console

**Qué se destraba:** Google lee el mapa del sitio (`/sitemap.xml`, ~200 páginas) y te avisa si alguna no se indexa.

1. https://search.google.com/search-console (abre) → «Agregar propiedad» → «Dominio» → `pichinchadeldia.com.ar`.
2. Verificá con el registro DNS que te da (se agrega en Cloudflare, donde está el dominio).
3. En «Sitemaps» agregá `https://pichinchadeldia.com.ar/sitemap.xml`.
4. A la semana mirame lo que diga en «Páginas»: me sirve para saber cuáles no entran y por qué.

---

## 7. Contador o despachante (una consulta, 8 reglas)

La calculadora de «Costo de importar» usa valores confirmados en normas oficiales, salvo estas 8 reglas que quedaron
**«pendiente»** en `importacion.json` (hasta confirmarlas se usa el valor prudente indicado en cada una). Si cualquiera
de las 8 te la confirma un despachante, lo cargo con su fuente.

**Mensaje armado:**

> Hola [NOMBRE]. Tengo un sitio gratuito que estima cuánto cuesta comprar hardware en el exterior y recibirlo por
> courier a Argentina. ¿Me podés confirmar, con la norma, estos puntos? (para el hardware: placas de video,
> procesadores, memorias, discos, periféricos, notebooks, consolas)
> 1. Derecho de importación por posición arancelaria de cada rubro (Nomenclatura Común del Mercosur, Decreto 557/2023
>    y modificatorios) y de las consolas (¿20%?).
> 2. Si el IVA reducido aplica a algún bien de hardware, o es siempre el 21%.
> 3. Si los impuestos internos integran la base imponible, y cómo se calculan.
> 4. Si las percepciones de IVA y Ganancias del régimen general alcanzan al courier.
> 5. Honorarios típicos del courier y tasa de servicio/almacenaje del Correo.
> 6. Qué etapa del cronograma de la RG 5884 está vigente hoy.
> 7. Topes de la tasa de estadística por declaración.
> 8. Cualquier otro costo que suela aparecer y que no esté en esta lista.
> Si prefieren no dar una opinión formal, me alcanza con las normas donde mirar. Gracias.

---

## 8. OmniRoute: reconectar Claude

La conexión `claude` figura vencida en el panel de OmniRoute (es tu panel local, no hay enlace público). Entrá,
reconectá la cuenta y, si querés, verificá con una consulta de prueba. Hasta entonces el respaldo de las revisiones es
solo Gemini.

---

## 9. Amazon (más adelante)

La Creators API de Amazon exige **10 ventas calificadas en los últimos 30 días** con tu cuenta de afiliado, así que
por ahora no corresponde.

1. Programa de afiliados: https://affiliate-program.amazon.com/ (abre).
2. Cuando la cuenta cumpla las 10 ventas, entrá a https://affiliate-program.amazon.com/creatorsapi (pide iniciar
   sesión) y generá las credenciales.
3. Secretos en GitHub: `AMAZON_CREATORS_ID` y `AMAZON_CREATORS_SECRET`.

Mientras tanto, «Afuera» arma el link de búsqueda a Amazon y un link de producto que pegues se lee igual.

---

## 10. Instagram (separado y en pausa)

Queda fuera del proceso diario de las pichinchas, como pediste: el PR #126 está en borrador. Si más adelante lo
retomás, hace falta:

1. Una cuenta de Instagram **profesional** (Configuración → Tipo de cuenta → «Cambiar a cuenta profesional»).
2. Una página de Facebook vinculada.
3. Una app en https://developers.facebook.com/apps (abre) con el producto de Instagram:
   https://developers.facebook.com/docs/instagram-platform (guía oficial).
4. Mi recomendación: solo avanzar si GoatCounter muestra que Instagram trae clics (es la condición que dejamos en el
   plan).

---

Si querés, decime cuáles hacés primero y te acompaño con cada uno, un paso por vez.
