# Plan v4: escalar a las tiendas de apps (desde el 12/11/2026)

Sigue a `docs/plan-v3.md`. El objetivo es que La Pichincha este en **Google Play** (primero) y en el **App Store** (despues,
con gatillo), con gente real usandola, y que los errores se detecten y se arreglen solos las 24 horas.

Metrica norte (la misma desde el plan de escalado): **clics salientes a tiendas por semana**. Se suman: instalaciones
activas, alertas creadas y tiempo entre que algo se rompe y queda arreglado (MTTR).

Regla de oro del plan: **la app es el mismo sitio**. No se escribe una segunda aplicacion: se envuelve la PWA que ya existe
(`manifest.webmanifest`, `sw.js`, `publicar_app.py`). Asi cada arreglo del sitio llega a la app sin pasar por la tienda.

---

## 0. Orden y puertas

| Fase | Que | Puerta para pasar a la siguiente | Semana |
| --- | --- | --- | --- |
| **0** | Correcciones 24/7 (seccion 7) | etapa 1 andando: deteccion + aviso en menos de 15 min | 1 (y siempre) |
| **1** | Auditoria previa (seccion 1) | todos los criterios de salida en verde | 1-2 |
| **2** | Investigacion (seccion 2) | ficha de la tienda escrita y 3 rivales medidos | 1-2, en paralelo |
| **3** | Arquitectura y app Android (seccion 3) | AAB firmado por la CI, `assetlinks.json` verificado | 2-3 |
| **4** | Prueba cerrada en Play: 12 personas, 14 dias (secciones 4 y 5) | 14 dias seguidos con 12 o mas, cero cierres | 3-5 |
| **5** | Produccion por etapas y promocion (secciones 6 y 8) | 7 dias al 100% sin alertas rojas | 6-8 |
| **6** | iOS (seccion 3.3) | solo con el gatillo: 1.000 instalaciones Android o 300 alertas activas | despues |

La Fase 0 va primero a proposito: no se lanza algo que, cuando se rompa de noche, nadie se entere hasta la mañana.

---

## 1. Auditoria previa (puerta de entrada)

Se hace con las skills que ya estan instaladas, una por eje, y el resultado va a `docs/auditorias/AAAA-MM-DD-pre-tiendas.md`.
Cada hallazgo se clasifica P0 (frena el lanzamiento), P1 (antes de produccion) o P2 (despues).

| Eje | Herramienta | Criterio de salida |
| --- | --- | --- |
| Calidad web y Lighthouse movil | `web-quality-audit`, `web-perf`, job `lighthouse` de `tests.yml` | rendimiento 90+ en portada y `/?q=`; accesibilidad, buenas practicas y SEO 95+ |
| Uso real con datos feos | `ux-audit`, `break-ui` | nada se rompe con titulos largos, 0 resultados, sin red |
| Accesibilidad | `accessibility` (WCAG 2.2 AA) | 0 fallas de axe; objetivos tactiles de 48 px (Play los mide) |
| Seguridad | `security-review`, Strix cuando Docker levante, `docs/seguridad-zap.md` | 0 altas ni medias; CSP sin `unsafe-inline` nuevo |
| Produccion | `production-audit` (ECC) | que pasa si cae GitHub Pages, el Worker o una tienda: todo tiene respuesta |
| Reglas del indice | `/medir-indice` | ofertas, repetidas y premium dentro de lo medido en `main` |
| PWA instalable | Lighthouse PWA + PWABuilder (reporte) | manifiesto completo (`id`, `screenshots`, `shortcuts`), funciona sin red |
| Legal y datos | revision de `/legal/` | politica de privacidad con URL fija, contacto real, Ley 25.326 (ver 4.3) |
| Diseño | `impeccable`, `critique-visual-hierarchy` | la pantalla de inicio se entiende en 5 segundos en un telefono |

Lo que ya sabemos que falta (de la auditoria del 11/11 y del plan v3): calculo de ofertas en un Web Worker y el indice
partido por rubro (Lighthouse movil todavia por debajo de 90), y el manifiesto sin `id`, `screenshots` ni `shortcuts`.

---

## 2. Investigacion

### 2.1 Rivales (a medir, no a copiar)

| Rival | Que hace | Que miramos |
| --- | --- | --- |
| Precialo | comparador general de Argentina, web | rubros, cuanto tarda, si tiene app |
| Rondo | comparador nuevo, se promociona en Instagram | ficha, reseñas, que promete |
| ComparaYa | filtros por especificacion | filtros (ya es referencia, plan-v2) |
| Geizhals (Austria) | el mejor comparador de hardware del mundo, con app | historial de precio, alertas, ficha de la app |
| Promodescuentos / r/DescuentosArgentina | ofertas por la comunidad | donde esta la gente que compra hardware |

Se miden con el proveedor `play-google-com` de Firecrawl (ficha, puntaje, reseñas) y se guarda un cuadro en
`docs/investigacion-tiendas.md`: que piden los usuarios en las reseñas de los rivales y que les molesta. Eso define la
ficha y las 3 funciones que se muestran primero.

### 2.2 Palabras de busqueda (ASO, o sea, SEO dentro de la tienda)

- De Search Console: las consultas que ya traen gente a `/precios/` (son las que la gente escribe).
- De GoatCounter: las busquedas internas, sobre todo las que dan 0 resultados (`busqueda_vacia`).
- De las sugerencias de Play (`media/app_suggest`): «comparador de precios», «precio placa de video», «ofertas hardware».
- Salida: titulo (30 caracteres), descripcion corta (80) y larga (4.000) con esas palabras, sin repetirlas de mas.

### 2.3 Preguntar a la gente

- Una encuesta de 3 preguntas en el canal de Telegram y en `/hoy/`: que compraste ultimo, donde buscaste el precio,
  que te haria instalar una app.
- 5 charlas cortas con quienes respondan (son tambien los primeros probadores de la seccion 4).

---

## 3. Arquitectura para las tiendas

### 3.1 Decision

| Opcion | Para que tienda | Costo | Veredicto |
| --- | --- | --- | --- |
| **TWA con Bubblewrap** (Google, open source): la app abre la PWA en Chrome a pantalla completa | Google Play | USD 25 una vez; sin codigo nuevo | **si: primero** |
| PWABuilder (Microsoft, open source) | Microsoft Store, Samsung Galaxy Store | gratis | **si, junto con Play** (casi sin costo) |
| Capacitor (open source) con funciones nativas | App Store | USD 99 por año + Mac en la nube | **solo con el gatillo** (Apple rechaza un sitio envuelto, regla 4.2) |
| Reescribir en React Native o Flutter | ambas | meses de trabajo y dos codigos que mantener | **no** |

### 3.2 Android (TWA)

```
              pichinchadeldia.com.ar (GitHub Pages, el mismo sitio)
                 |                         |
   /.well-known/assetlinks.json      PWA: manifest + sw.js
   (prueba que la app es nuestra)          |
                 |                         |
        App Android "ar.com.pichinchadeldia.app" (TWA, Bubblewrap)
                 |
     GitHub Actions: compila el AAB, lo firma, lo sube a Play (pista interna)
```

- `assetlinks.json`: lo genera `publicar_app.py` con la huella SHA-256 de la clave de firma de Play (no es un secreto). Un
  test exige que exista y que la huella coincida con `sitio.json`. Con GitHub Pages hace falta `.nojekyll` para servir
  carpetas que empiezan con punto.
- Carpeta nueva `app-android/` con `twa-manifest.json` (Bubblewrap). La version de la app solo cambia cuando cambia la
  cascara (icono, nombre, permisos), no con cada precio.
- Firma: **Play App Signing** (Google guarda la clave final). La clave de subida va en secretos de GitHub
  (`PLAY_UPLOAD_KEYSTORE`, `PLAY_UPLOAD_PASSWORD`) y la cuenta de servicio de Play en `PLAY_SERVICE_ACCOUNT_JSON`.
- Workflow nuevo `app.yml`: a mano o con una etiqueta `app-v*`, compila con Bubblewrap, corre los tests, sube a la pista
  interna con la API de publicacion de Play. Pasar a produccion siempre es manual (decision del dueño).
- Notificaciones: la TWA usa las notificaciones web de Chrome (Web Push); en Android 13+ pide permiso. Van con las
  alertas de precio (3.4).

### 3.3 iOS (solo con el gatillo)

Apple rechaza «un sitio reempaquetado» (regla 4.2 y 4.2.2: nada de «colecciones de enlaces» ni agregadores sin mas). Para
pasar hace falta que la app haga algo que el sitio no puede:

- **Widget** con la pichincha del dia en la pantalla de inicio.
- **Notificaciones nativas** de alertas de precio (APNs).
- **Compartir a La Pichincha**: desde Safari o Mercado Libre, «compartir» un producto y ver si hay algo mejor.

Se arma con Capacitor (la misma web adentro) y se compila en GitHub Actions con un runner macOS (sin comprar una Mac).
Gatillo: 1.000 instalaciones activas en Android o 300 alertas activas. Antes de eso, los usuarios de iPhone usan la PWA
(«Agregar a inicio»), que en iOS 16.4+ ya recibe notificaciones.

### 3.4 Lo que la app necesita del lado del servidor (el gatillo de alertas del plan v3)

La app sin alertas es solo un acceso directo. Las alertas son el motivo para instalarla, y son el gatillo que el plan v3
dejo escrito para tener estado. Se hace con lo mas chico:

- **Cloudflare Worker + D1** (SQLite, plan gratis): guarda `{suscripcion push, producto o busqueda, precio objetivo}`.
  Sin cuentas ni contraseñas: la suscripcion del navegador es la identidad.
- La corrida diaria (`actualizar.yml`) deja `indice.json`; un paso nuevo le pasa al Worker los precios que bajaron y el
  Worker manda los avisos (Web Push con claves VAPID en secretos del Worker).
- Alternativa por correo para quien no quiere notificaciones: Resend (3.000 por mes gratis; 100 por dia).
- La constitucion se enmienda (1.2.0): «estado minimo y sin cuentas, solo para alertas».

---

## 4. Captura de clientes

Hay dos clientes distintos y cada uno tiene su embudo.

### 4.1 Compradores (usuarios de la app)

```
Google / /precios/  ->  ve el precio  ->  «avisame si baja» (alerta)  ->  instala la app  ->  vuelve por el aviso
Telegram / Reddit   ->  /hoy/         ->  boton «instalar»            ->  ...
```

- Boton «Instalar la app» en `/hoy/` y en cada `/precios/` (con el enlace a Play en Android y «Agregar a inicio» en iPhone).
- La alerta es el gancho: se ofrece en el momento en que la persona mira un precio.
- Los primeros 12 probadores (requisito de Play) salen del canal de Telegram y de las charlas de 2.3. Se piden 20 para
  tener margen: si baja de 12, el reloj de 14 dias se reinicia.

### 4.2 Tiendas (el lado del negocio)

- A cada tienda que ya relevamos se le ofrece, sin costo al principio: su ficha con datos correctos, el reporte de cuantos
  clics les mandamos (de GoatCounter) y la invitacion a un feed propio (asi no hay que leer su sitio).
- Mas adelante: afiliados (Mercado Libre ya esta; otros programas por tienda) y lugar destacado marcado como «patrocinado».
- Lista de tiendas y estado del contacto en el repo privado `la-pichincha-correo` (nunca en el publico).

### 4.3 Datos personales (Ley 25.326)

- Solo se guarda lo minimo: la suscripcion push (no dice quien es la persona) y, si eligen correo, el correo.
- Si hay base con correos: inscribirla en el registro de la AAIP y decirlo en `/legal/`. Borrado con un clic.
- Formulario de «Seguridad de los datos» de Play: lo que se junta, para que, y que se puede borrar.

---

## 5. Contacto

- **Correo del dominio**: `contacto@pichinchadeldia.com.ar` con Cloudflare Email Routing (gratis) que reenvia al correo
  del dueño. Va en `/legal/`, en la ficha de Play (obligatorio) y en la app.
- **Formulario en el sitio** -> el Worker -> issue en el repo **privado** `la-pichincha-correo` con la etiqueta
  `contacto`. La rutina de Gmail que ya existe los lee cada mañana.
- **Reseñas de Play**: la API de reseñas de Play las trae una vez por dia; las de 1-2 estrellas abren un issue privado.
  Respuesta en menos de 48 horas con plantillas (falla conocida, pedido de funcion, tienda que falta).
- **Tiendas**: carta modelo (como las de FullH4rd, Compra Cierta y Loquieroaca) con el seguimiento a 7 dias.

---

## 6. Despliegue final

1. **Pista interna** (solo el dueño): cada AAB nuevo cae aca. Se prueba en un telefono real.
2. **Prueba cerrada** (12-20 personas, 14 dias minimo): requisito de Play para cuentas personales nuevas. Se miden
   cierres (crash), ANR y lo que reportan.
3. **Pedido de acceso a produccion**: se responden las preguntas de Play sobre la prueba.
4. **Produccion por etapas**: 10% -> 50% -> 100%, con 48 horas entre cada paso. Si las «Android vitals» pasan los umbrales
   de Play (cierres por encima de 1,09%, ANR por encima de 0,47%), se **frena el despliegue** con la API, sin esperar.
5. **Microsoft Store y Galaxy Store** con el paquete de PWABuilder, el mismo dia que produccion.
6. **Volver atras**: como la app muestra el sitio, casi todo se arregla con `git revert` en el sitio (minutos). Solo un
   problema de la cascara pide una version nueva del AAB.

Antes de cada paso: leer los correos (regla del CLAUDE.md) y que la CI este en verde.

---

## 7. Correcciones 24/7, solas (la parte mas importante)

Hoy hay piezas sueltas: la corrida diaria con reintentos (E1-E4, spec 061), el aviso privado por Telegram, Sentry
(spec 062), la rutina de Gmail que abre issues privados, el revisor automatico y `arreglar-con-claude.yml` (apagado). El
plan las une en un solo circuito, como un termostato: mide, compara, corrige y vuelve a medir.

```
  DETECTAR ---> CLASIFICAR ---> ARREGLAR ---> VERIFICAR ---> AVISAR
     ^                                            |
     +------------- si no quedo bien, vuelve -----+   (y si empeora: revert automatico)
```

### 7.1 Detectar (cada 5 minutos, no cada dia)

| Fuente | Que mira | Como | Frecuencia |
| --- | --- | --- | --- |
| Vigia (nuevo) | portada, `/hoy/`, un `/precios/`, `indice.json` con fecha de hoy, `assetlinks.json` | **Cron Trigger de Cloudflare** en el Worker (los cron de GitHub se atrasan hasta 1 hora) | 5 min |
| Sentry | errores de JavaScript en la web y en la app | alerta por correo + webhook al Worker | al instante |
| Salud de fuentes | tiendas en 0, bloqueos, 429 | `salud.py` en `actualizar.yml` | cada corrida |
| CI | tests, e2e, Lighthouse | `workflow_run` | cada push |
| Play | cierres, ANR, reseñas de 1-2 estrellas | API de informes de Play y de reseñas, desde un workflow | 1 vez por dia |
| Correo | Search Console, Cloudflare, GitHub, Sentry | rutina de Gmail -> issues privados | 1 vez por dia |

### 7.2 Clasificar

Cada señal termina en un **issue** con una huella (que fallo + donde), asi la misma falla no abre 20 issues:

- **Conocida** (catalogo E1-E4 y los que se vayan sumando, E5+): tiene receta escrita y test. Se aplica sola.
- **Nueva**: etiqueta `arreglar-con-claude` puesta por el sistema, con el contexto (traza de Sentry, salida de la corrida,
  captura del vigia).
- **Ajena** (script del navegador, tienda que bloquea, caida de GitHub): se anota y se cierra sola si se repite el patron
  ya conocido (como el filtro de Sentry del PR #260).

### 7.3 Arreglar

| Nivel | Que es | Quien | Merge |
| --- | --- | --- | --- |
| 1 | receta conocida (reintentar, usar lo anterior con su fecha, saltear tienda) | el codigo de `indexar.py` | no hace falta: no cambia codigo |
| 2 | falla nueva de bajo riesgo: selector de una tienda, fixture, texto, test que se rompio por una fecha | Claude en Actions (`arreglar-con-claude.yml`) | **solo** si la CI esta toda en verde, `/medir-indice` no empeora y el cambio toca nada mas que archivos de la lista permitida |
| 3 | falla nueva que toca publicacion, ofertas, precios, seguridad, workflows o secretos | Claude abre el PR | **el dueño** |

Barandas (para que el arreglador automatico no haga daño ni gaste de mas):

- Interruptor general: `ARREGLO_CLAUDE` (ya existe). Apagarlo frena todo.
- Tope: 5 arreglos automaticos por dia y 2 intentos por issue; despues, al dueño.
- Lista permitida de archivos para nivel 2 (por ejemplo `tiendas.json`, `tests/fixtures/`, extractores de una tienda).
  Nunca: `.github/workflows/`, `guardia.*`, `publicar_*.py`, `sitio.json`, secretos.
- Corre con la suscripcion (`CLAUDE_CODE_OAUTH_TOKEN`), nunca con la API paga.
- Cada PR automatico dice «automatico» en el titulo y enlaza el issue y la evidencia.

### 7.4 Verificar y volver atras solo

- Despues de cada merge, el vigia corre al minuto (no a los 5) durante 30 minutos.
- Si en ese tiempo aparece un error nuevo en Sentry o el vigia falla: **`git revert` automatico** del merge, issue con la
  evidencia y aviso. Volver atras es seguro; seguir con algo roto, no.

### 7.5 Avisar

- 🔴 (sitio caido, indice viejo, revert hecho): Telegram privado al instante.
- 🟡 (tienda en 0, PR de nivel 3 esperando): resumen a las 8:00.
- 🟢 (arreglo automatico mergeado): en el resumen diario, con el enlace.
- Pagina `/estado/` publica con lo que esta atrasado (ya existe) + historial de caidas del vigia.

### 7.6 Que falta para que ande (en orden)

1. Prender `ARREGLO_CLAUDE` (**lo hace el dueño**: `gh variable set ARREGLO_CLAUDE --body si`) y probarlo con el #241.
2. Vigia con Cron Trigger en el Worker + aviso por Telegram.
3. Huella de issues para no duplicar; etiquetado automatico de los nuevos.
4. Lista permitida y merge automatico de nivel 2.
5. Revert automatico tras el merge.
6. Fuentes de Play (cuando la app exista).

Objetivos: detectar en menos de 10 minutos; arreglar una falla conocida en menos de 1 hora; una nueva de nivel 2 en
menos de 6 horas, de dia o de noche.

---

## 8. Promocion

| Cuando | Que | Donde |
| --- | --- | --- |
| Antes (semanas 2-4) | buscar probadores; mostrar el avance | canal de Telegram, r/DescuentosArgentina, foros de hardware |
| Lanzamiento | «la app que te avisa cuando baja la placa que queres» | Telegram, Reddit, grupos de armado de PC, ficha de Play con video de 30 s |
| Black Friday (27/11) y Cyber Monday | `/hoy/` especial: que bajo de verdad contra el piso de 30 dias | todo lo anterior + prensa de tecnologia |
| Hot Sale (mayo 2027) | lo mismo, con alertas ya funcionando | idem |
| Siempre | el contenido de `/precios/` (SEO) y el mensaje diario de Telegram | Google, Telegram |

- Instagram sigue **frenado** hasta aprobar la app al 100% (regla del dueño): no entra en este plan hasta que se apruebe.
- Imagenes de la ficha: capturas reales del telefono, y las graficas con las herramientas gratis (Cloudflare FLUX o
  Hugging Face), revisadas antes de usar.
- Nada de reseñas pagadas ni inventadas; Play las borra y suspende la cuenta.

---

## 9. Decisiones del dueño (plata, cuentas, normativa)

| Decision | Costo | Recomendacion |
| --- | --- | --- |
| Cuenta de Google Play: personal o de organizacion | USD 25 una vez | personal; la de organizacion evita los 12 probadores pero pide numero D-U-N-S |
| Prender `ARREGLO_CLAUDE` | usa la suscripcion | si, ya: es la base de la seccion 7 |
| Cuenta de Apple Developer | USD 99 por año | esperar el gatillo de la seccion 3.3 |
| Inscribir la base de correos en la AAIP | gratis | si, antes de juntar correos |
| Correo `contacto@` del dominio | gratis | si |

---

## 10. Riesgos

| Riesgo | Que se hace |
| --- | --- |
| No llegar a 12 probadores durante 14 dias | pedir 20; recordatorio por Telegram el dia 7 |
| Play rechaza por «poca funcion» (tambien aplica en Android) | lanzar con alertas, no antes |
| Una tienda pide que no la mostremos | se saca en el dia (`tiendas.json`) y se responde por escrito |
| El arreglador automatico rompe algo | lista permitida, CI, revert automatico y tope diario |
| Se cae GitHub Pages | el vigia lo detecta; Cloudflare sirve la ultima copia guardada |
