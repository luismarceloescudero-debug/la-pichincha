# Pendientes que dependen de vos

Última revisión: 30/10/2026 (ítem 1); 24/10/2026 (el resto). Cada ítem dice **qué se destraba**, el **paso a paso**, los **enlaces** (revisados el
24/10 desde el entorno de trabajo: los que piden iniciar sesión o tienen anti-bots están marcados) y, cuando hay que
escribirle a alguien, el **mensaje ya armado**. Entre `[CORCHETES]` va lo que tenés que completar vos.

Ningún mensaje dice cifras de visitas ni de ventas que el sitio no tenga medidas.

| # | Pendiente | Qué se destraba | Tiempo |
|---|---|---|---|
| 1 | Activar el formulario de contacto | Que lleguen a tu Gmail los mensajes de /contacto/ sin publicar tu correo, y completar «Acerca de» | 15 min |
| 2 | Escribir a FullH4rd, Katech, Compra Cierta y Loquieroacá | Cuatro tiendas que hoy no entran al índice o a «Afuera» | 15 min |
| 3 | eBay (claves y afiliados) | «Afuera» con eBay: precios en vivo y comisión | 30 min + espera |
| 4 | AliExpress (claves y afiliados) | «Afuera» con AliExpress, y comisión | 30 min + espera |
| 5 | Mercado Libre: confirmar clics | Saber si el link de afiliado cuenta | 2 min |
| 6 | Google Search Console | Que Google lea el mapa del sitio y avise de errores | 10 min |
| 7 | ~~OmniRoute: reconectar Claude~~ | Cerrado el 27/10: el respaldo ahora es FCC | — |
| 8 | Amazon (más adelante) | Amazon en «Afuera» | cuando haya 10 ventas |
| 9 | Instagram (separado, en pausa) | Publicar la tarjeta del día | cuando lo retomes |
| 10 | Tiendamia: pedir permiso para leer la cotización | Mostrar el envío y los servicios de importación sin que la persona pegue su carrito | 5 min + espera |
| 11 | Tiendamia: armar los carritos de prueba | La base para encontrar cómo calcula Tiendamia el envío y los servicios | 15 min |

---

## Estado al 01/11/2026 (sesion de auditoria)

Verificado con la captura de los secretos de GitHub y una prueba en vivo del Worker. La pagina «Pendientes de La Pichincha»
(https://claude.ai/artifact/31tfse3HEy4t53HqFtxfvG) tiene el mismo estado, con los pasos y enlaces directos para el celular.

| # | Estado |
|---|---|
| 1 | Secretos `CONTACTO_DESTINO`, `CONTACTO_REMITENTE` y `RESEND_API_KEY` cargados. Falta probar el formulario de punta a punta cuando se terminen de enviar las cartas |
| 2 | Enviadas las 4 cartas (02/11) por correo y por Instagram y Facebook. Seguimiento: 16/11/2026 |
| 3 | eBay: claves cargadas y busqueda en vivo OK (el 401 del 25/10 ya no aparece). Falta solo `EBAY_CAMPAIGN_ID` (hoy los links salen con `afiliado: false`) |
| 4 | AliExpress: sin ningun `ALIEXPRESS_*` en los secretos; pendiente |
| 5 | Mercado Libre: clics confirmados. Cerrado |
| 6 | Search Console: pendiente; el registro TXT se carga en Cloudflare (mas facil con el conector de la API de Cloudflare) |
| 8 | Amazon: sitio declarado; la Creators API espera las 10 ventas |
| 9 | Instagram: en pausa |
| 10 | Tiendamia pidio hablar por telefono: llamada el lunes 02/11 |
| 11 | Carritos de Tiendamia: conviene esperar la respuesta de la llamada |

---

## 1. Activar el formulario de contacto

**Qué se destraba:** el formulario de https://pichinchadeldia.com.ar/contacto/ (spec 046). Ya está publicado, igual que
`/.well-known/security.txt` y «Acerca de», pero hasta que hagas estos pasos responde «El formulario de contacto todavía no
está activo».

**Cómo funciona:** quien escribe completa el formulario; el Worker «Afuera» te lo manda por correo desde
`hola@pichinchadeldia.com.ar` a tu Gmail, con «Responder a» la dirección de esa persona. **Tu correo personal no se
publica en ningún lado**: no está en el sitio, ni en el `security.txt`, ni en el repositorio (va como secreto). Si un día
llega spam, se cambia la dirección sin tocar tu Gmail.

**Antes de empezar** (ya verificado el 30/10): `pichinchadeldia.com.ar` usa los DNS de Cloudflare
(`mallory` y `stanley.ns.cloudflare.com`) y todavía no tiene registros MX, así que no se pisa ningún correo existente. El
dominio y el Worker `pichincha-afuera` tienen que estar en **la misma cuenta** de Cloudflare.

**Paso a paso** (~15 minutos). El panel de Cloudflare cambia los nombres de los menús seguido: si no coinciden, seguí la
documentación enlazada en cada paso.

1. **Activar Email Routing.** Entrá a https://dash.cloudflare.com/ → **Compute** → **Email Service** →
   **Email Routing** → **Onboard Domain** y elegí `pichinchadeldia.com.ar`. Cloudflare te muestra los registros que
   suma (MX, SPF y DKIM): aceptalos y tocá **Done**. Suelen tardar entre 5 y 15 minutos (hasta 24 h).
   Documentación: https://developers.cloudflare.com/email-service/get-started/route-emails/
2. **Verificar tu Gmail como destino.** En **Email Routing** → **Destination Addresses**, escribí tu Gmail y confirmá.
   Te llega un correo de Cloudflare: tocá **Verify email address**. Sin este paso el Worker no te puede mandar nada.
   Documentación: https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/
3. **Crear `hola@pichinchadeldia.com.ar`.** En **Email Routing** → tu dominio → **Routing Rules** →
   **Create routing rule**: en **Email pattern** poné `hola`, en **Action** «Send to an email» y en **Destination** tu
   Gmail verificado. **Save**.
4. **Probar la dirección.** Desde otra cuenta (no desde tu Gmail) mandá un correo a `hola@pichinchadeldia.com.ar`. Tiene
   que llegarte; si no, mirá en Spam.
5. **Cargar los dos secretos en GitHub.** En https://github.com/luismarceloescudero-debug/la-pichincha → **Settings** →
   **Secrets and variables** → **Actions** → **New repository secret**, creá:
   - `CONTACTO_DESTINO` = `[TU GMAIL VERIFICADO]`
   - `CONTACTO_REMITENTE` = `hola@pichinchadeldia.com.ar`

   El workflow «Desplegar el Worker Afuera» se los pasa al Worker con `wrangler secret put`, como las claves de eBay.
   Documentación: https://docs.github.com/es/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
6. **El binding en `worker/wrangler.toml`** (ya sumado el 31/10, sin `destination_address` a proposito):

   ```toml
   [[send_email]]
   name = "CORREO"
   ```

   Sin `destination_address`, el Worker solo puede mandar a direcciones **verificadas** en tu cuenta (la del paso 2).
   Documentación: https://developers.cloudflare.com/email-service/configuration/send-bindings/ y
   https://developers.cloudflare.com/email-service/api/send-emails/workers-api/
7. **Desplegar y probar.** Al mergear ese PR, el workflow despliega el Worker solo. Después entrá a
   https://pichinchadeldia.com.ar/contacto/, mandá un mensaje de prueba y fijate que te llegue, y que al tocar
   «Responder» salga la dirección que escribiste en el formulario.

**Para «Acerca de»:** hecho el 31/10. El texto sale de la filosofía que dijo el dueño (ofertas reales, con tecnología reciente,
características premium y buena construcción, lo mejor al mejor costo posible), sin nombre ni datos personales. Si más
adelante querés sumar tu nombre, está en `renderAcerca` de `generar_info.js`.

**Acuse de recibo con Resend** (spec 053, opcional pero decidido el 31/10): para que quien escribe reciba «Recibimos tu consulta».
El Worker ya está listo; sin la clave todo sigue como hoy. Pasos:

1. **Crear la cuenta** en https://resend.com/signup (plan gratis: 3.000 correos por mes y 100 por día).
2. **Agregar el dominio** en https://resend.com/domains → `pichinchadeldia.com.ar`, con el botón **Sign in to Cloudflare**, que carga los
   registros en el subdominio `send`. Guía: https://resend.com/docs/guides/dns/cloudflare. Si lo hacés a mano, los registros van con el
   proxy en «DNS only» y en el subdominio `send`. Esperá a que el dominio diga **Verified**.
3. **Crear la clave** en https://resend.com/api-keys con permiso solo de envío («Sending access») y restringida al dominio
   `pichinchadeldia.com.ar`. Copiala una sola vez; no la pegues en ningún chat.
4. **Cargarla como secreto** (pide el valor por teclado, sin mostrarlo):

   ```bash
   gh secret set RESEND_API_KEY --repo luismarceloescudero-debug/la-pichincha
   ```

5. **Desplegar:** corré el workflow «Desplegar el Worker Afuera» (Actions → Run workflow) o esperá al próximo cambio en `worker/`. Después mandá un
   mensaje de prueba desde `/contacto/` con otro correo tuyo: tiene que llegar el acuse y la página dice «Te mandamos un correo de confirmación».

El acuse sale desde `CONTACTO_REMITENTE` (`hola@pichinchadeldia.com.ar`), así que ese dominio es el que hay que verificar en Resend.

**Límites del formulario** (no hace falta tocarlos): campo trampa para robots, 3 segundos mínimos desde que se abre la
página, 5 mensajes cada 10 minutos por persona y mensajes de 10 a 4000 caracteres.

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
3. Afiliados: https://partnernetwork.ebay.com/ (abre bien) → «Join now» (https://partner.ebay.com/campaign-promo-signup/eBay-Partner-Network.brand).
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

## 7. OmniRoute (cerrado)

Ya no aplica: OmniRoute y OpenCode se desinstalaron el 27/10/2026 y el respaldo gratis de las revisiones es FCC
(`free-claude-code`, ver `docs/proceso-de-trabajo.md`). No hace falta reconectar nada.

---

## 8. Amazon (más adelante)

La Creators API de Amazon exige **10 ventas calificadas en los últimos 30 días** con tu cuenta de afiliado, así que
por ahora no corresponde.

1. Programa de afiliados: https://affiliate-program.amazon.com/ (abre).
2. Cuando la cuenta cumpla las 10 ventas, entrá a https://affiliate-program.amazon.com/creatorsapi (pide iniciar
   sesión) y generá las credenciales.
3. Secretos en GitHub: `AMAZON_CREATORS_ID` y `AMAZON_CREATORS_SECRET`.

Mientras tanto, «Afuera» arma el link de búsqueda a Amazon, y un link de Amazon que pegues se cruza con la ficha de
Tiendamia de ese mismo producto: su precio final (con envío e impuestos) es la referencia del costo importado y se
muestra el porcentaje contra el precio de Amazon que publica esa ficha (spec 039). Desde la spec 040 esa referencia
va en «Buscalo afuera» (ya no hay calculadora local). El precio de Amazon en vivo sigue
esperando las 10 ventas.

---

## 9. Instagram (separado y en pausa)

Queda fuera del proceso diario de las pichinchas, como pediste: el PR #126 está en borrador. Si más adelante lo
retomás, hace falta:

1. Una cuenta de Instagram **profesional** (Configuración → Tipo de cuenta → «Cambiar a cuenta profesional»).
2. Una página de Facebook vinculada.
3. Una app en https://developers.facebook.com/apps (abre) con el producto de Instagram:
   https://developers.facebook.com/docs/instagram-platform (guía oficial).
4. Mi recomendación: solo avanzar si GoatCounter muestra que Instagram trae clics (es la condición que dejamos en el
   plan).

---

## 10. Tiendamia: pedir permiso para leer la cotización (spec 041)

**Qué pasa:** la ficha de Tiendamia trae su precio y el de Amazon, pero el envío internacional y los servicios de
importación aparecen solo en el carrito (`/checkout/cart`), y su `robots.txt` lo prohíbe. No se esquiva: hoy la persona
pega el detalle del carrito a mano. Si Tiendamia nos autoriza (o nos da una API), el sitio puede mostrarlo solo.

**Paso a paso:** mandá el mail desde tu correo a la dirección de contacto de Tiendamia (en https://tiendamia.com.ar/ ,
al pie: «Contacto» o «Ayuda»; abrilo desde el navegador). Si contestan, pasame la respuesta tal cual.

> **Asunto:** Consulta: leer la cotización de envío e impuestos de productos de Tiendamia en La Pichincha
>
> Hola, ¿cómo están? Soy [TU NOMBRE] y armé La Pichincha (https://pichinchadeldia.com.ar), un comparador gratuito de
> precios de hardware en Argentina. Cuando un producto no está en las tiendas locales, mostramos dónde comprarlo afuera,
> y Tiendamia es una de las opciones que recomendamos, con el link directo a su ficha.
>
> Hoy leemos sus fichas públicas (`/p/...`), siempre dentro de lo que permite su robots.txt. Pero el costo final para la
> persona (envío internacional y servicios de importación) aparece solo en el carrito, y su robots.txt no permite
> leerlo, así que no lo hacemos. Queremos mostrar el costo completo y no un número a medias.
>
> ¿Podrían ayudarnos con alguna de estas opciones?
> 1. Una API o un endpoint de cotización (producto y destino → envío y servicios de importación).
> 2. Autorización por escrito para consultar la cotización del carrito a un ritmo bajo (con caché de horas), sin
>    cuentas ni compras.
> 3. La regla con la que calculan el envío y los servicios (por peso, por precio o por categoría), para estimarla
>    nosotros y aclarar siempre que es una estimación.
>
> Para ustedes no tiene costo: la compra se hace siempre en Tiendamia. Si tienen un programa de afiliados, también nos
> interesa. Quedo atento, gracias.
>
> [TU NOMBRE] · [TU CONTACTO]

---

## 11. Tiendamia: armar los carritos de prueba (spec 041)

**Qué se destraba:** con varios carritos reales se puede buscar la regla del envío (¿por peso?) y de los servicios
(¿un porcentaje?, ¿mínimos?). Está la lista en `specs/041-cargos-tiendamia/datos.md`: un producto de Amazon por
categoría del sitio, con pesos de 0,1 a 5,85 kg.

**Paso a paso:** en la página «Carritos de Tiendamia» (https://claude.ai/artifact/XPWp1R98sJvpftxUtrY9gg, privada,
con tu cuenta de claude.ai) cada producto tiene «Abrir en Tiendamia»: agregalo al carrito, copiá el bloque «Detalle de
la compra» (hasta «Subtotal»), pegalo en su campo y tocá «Guardar». Cuando me avises, leo lo guardado y la ficha ese
mismo día, agrego las entradas a `datos/tiendamia-cargos.json` y lo commiteo. No hace falta comprar ni iniciar el pago.
Si el carrito dice «NO PERMITIDO · ADUANA» (pasó con un power bank), avisame y busco otro de la misma categoría.

---

Si querés, decime cuáles hacés primero y te acompaño con cada uno, un paso por vez.
