# Google Play: privacidad y formulario de «seguridad de los datos» (25/11/2026)

Es la parte de la etapa final que el plan no tenia (hueco 1 de la lista de `shipping-and-launch`). Se hace **cuando se cumplan los 7
criterios** (`docs/plan-definitivo.md`, seccion 8) y despues de pagar la cuenta: antes de eso no hay consola donde cargarlo.
Son respuestas **propuestas**: al llenar el formulario se confirman contra lo que pregunte la consola ese dia.

## Lo que ya esta listo

- **Politica de privacidad publica**: https://pichinchadeldia.com.ar/legal/ (sin login, no es un PDF; es lo que Play pide como enlace).
- Cubre: sin cuentas, GoatCounter sin cookies, errores tecnicos con Sentry, el formulario de contacto, Resend para el aviso de
  confirmacion, derechos de la Ley 25.326 (arts. 14, 15 y 16) con la AAIP, afiliados y, desde el 25/11, **donde esta el sitio**
  (GitHub Pages y Cloudflare, que ven la IP solo para entregar y proteger) y cuanto dura el mensaje del formulario.
- El correo para consultas y derechos es `hola@pichinchadeldia.com.ar`.

## Respuestas propuestas para «Seguridad de los datos» (Play Console)

Guia oficial de Google: https://support.google.com/googleplay/android-developer/answer/10787469

| Pregunta | Respuesta propuesta | Por que |
|---|---|---|
| ¿La app recopila o comparte datos? | **Si** | Sentry (errores) y GoatCounter (visitas) reciben datos tecnicos; el formulario de contacto recibe un correo. |
| ¿Se cifran los datos en transito? | **Si** | Todo va por HTTPS (HSTS activo desde el 25/11). |
| ¿Pueden pedir que se borren sus datos? | **Si, por correo** | `hola@pichinchadeldia.com.ar`, asunto «Derechos ARCO»; no hay cuentas. |
| Ubicacion aproximada | Recopilada, **compartida con un tercero (Sentry)**, no obligatoria, para «analisis» y «diagnostico» | Sentry guarda como mucho la ciudad aproximada de un error. |
| Informacion de la app y rendimiento (registros de fallas, diagnosticos) | Recopilada y compartida (Sentry), no obligatoria | Qué fallo, archivo y linea, navegador y sistema. |
| Actividad en la app (busquedas, clics a tiendas) | Recopilada (GoatCounter), **anonima**, no vinculada a la persona | Sin cookies, sin identificar a nadie. |
| Informacion personal: nombre y correo | Recopilada **solo si la persona usa Contacto**, no obligatoria, para «comunicacion con el usuario»; el aviso de confirmacion pasa por Resend | Se manda por correo al dueño; no se guarda en una base. |
| Datos financieros, salud, fotos, contactos, mensajes, identificadores del dispositivo | **No** | La app no los pide. |
| ¿Se usa para publicidad o se vende? | **No** | Los afiliados no reciben datos de la persona. |

## Pasos para el dueño (cuando llegue el momento)

1. Entrá a https://play.google.com/console y abrí la app.
2. Andá a **Contenido de la app → Seguridad de los datos** y cargá las respuestas de la tabla (la guia oficial de arriba explica cada pantalla).
3. En **Contenido de la app → Politica de privacidad**, pegá `https://pichinchadeldia.com.ar/legal/`.
4. Antes de enviar a revision, repasá la lista oficial: https://support.google.com/googleplay/android-developer/answer/9859455
5. Si la consola pide un metodo de borrado de cuenta: la app no tiene cuentas, asi que no corresponde; la regla esta en
   https://support.google.com/googleplay/android-developer/answer/13327111

## Decisiones que son del dueño

- **Nombre del desarrollador**: Play pide que la politica identifique a quien publica. Hoy dice «quien hace el sitio». Hay que decidir
  si se pone un nombre (persona o marca) en `/legal/`; Claude lo agrega apenas lo digas.
- **Cuanto dura el mensaje del formulario**: la politica dice que se borra «cuando ya no hace falta». Si preferis un plazo fijo
  (por ejemplo 12 meses), se escribe.
- **Edad del publico**: la consola pregunta a quien esta dirigida la app (la propuesta: adultos).
