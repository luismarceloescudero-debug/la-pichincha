# App Android (TWA)

La app es **el mismo sitio**: envuelve la PWA que ya publica `publicar_app.py` con una TWA (Trusted Web
Activity) armada con [Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap), de Google. No hay una
segunda aplicacion: cada arreglo del sitio llega a la app sin pasar por la tienda. Fase 3 del
[plan v4](../docs/plan-v4-tiendas-de-apps.md), seccion 3.2.

```
pichinchadeldia.com.ar  (GitHub Pages, el mismo sitio)
   |                          |
   | /.well-known/assetlinks.json      PWA: manifest.webmanifest + sw.js
   | (prueba que la app es nuestra)          |
   +------------> app Android "ar.com.pichinchadeldia.app"
```

## Que hay en esta carpeta

| Archivo | Que es |
| --- | --- |
| `twa-manifest.json` | lo que lee Bubblewrap: paquete, nombre, colores, version, iconos y donde esta la clave de firma |
| `.gitignore` | la clave y lo que compila Bubblewrap quedan afuera del repo |

El paquete (`ar.com.pichinchadeldia.app`) y las huellas de firma viven en **un solo lugar**: el bloque
`app_android` de [`sitio.json`](../sitio.json). `twa-manifest.json` repite el paquete y el dominio porque
Bubblewrap pide URLs absolutas; un test exige que digan lo mismo que `sitio.json` y `manifest.webmanifest`
(`tests/test_app_android.py`), asi que si cambia el dominio el test lo marca y no queda uno viejo.

## Como se arma

1. **CI (lo normal)**: el workflow [`app.yml`](../.github/workflows/app.yml), a mano o con una etiqueta
   `app-v*`. Instala Bubblewrap, firma con la clave de subida y deja como artefactos el AAB, el APK de prueba
   y `huella.txt` (la huella SHA-256 del certificado).
2. **A mano en una maquina con el SDK de Android y Java 17**:

   ```bash
   npm install --global @bubblewrap/cli@1.24.1
   cd app-android
   bubblewrap build --skipPwaValidation
   ```

   Sin la clave de subida, Bubblewrap ofrece crear una: sirve para probar en un telefono, no para Play.

La version de la app (`appVersionCode`) **solo sube cuando cambia la cascara** (icono, nombre, permisos), no
con cada precio: los precios los arregla el sitio solo. Play no acepta dos AAB con el mismo `appVersionCode`.

## La huella y el assetlinks.json

`assetlinks.json` es lo que hace que la app abra a pantalla completa, sin la barra del navegador arriba: dice
que la app `ar.com.pichinchadeldia.app` firmada con tal certificado es duena de este dominio.

- Lo arma `publicar_app.py` en cada publicacion, en `/.well-known/assetlinks.json`, con el paquete y las
  huellas de `sitio.json`. Tambien deja `.nojekyll` para que GitHub Pages sirva la carpeta con punto.
- Las huellas **no son secretas**: son la parte publica del certificado. Se cargan a mano en
  `app_android.huellas_sha256` de `sitio.json`, que es una lista: van la de la **clave de subida** (la que
  imprime `app.yml`) y la de **Play App Signing** (la muestra Play Console cuando la cuenta este).
- Mientras la lista este vacia, el archivo se publica igual pero la app **no verifica el dominio** y abre con
  la barra del navegador. `publicar_app.py` lo avisa con un `::warning::` en cada corrida.
- Para comprobar que quedo bien:

  ```bash
  curl -s https://pichinchadeldia.com.ar/.well-known/assetlinks.json
  # y la verificacion de Google, con el paquete y la huella:
  # https://developers.google.com/digital-asset-links/tools/generator
  ```

## Secretos y decisiones del dueno

| Nombre | Que es | Quien lo carga |
| --- | --- | --- |
| `PLAY_UPLOAD_KEYSTORE` | el `.keystore` de subida en base64 (`base64 -w0 android.keystore`) | el dueno |
| `PLAY_UPLOAD_PASSWORD` | la contrasena de esa clave | el dueno |

Sin esos secretos el workflow compila con una clave de prueba y lo dice: sirve para ver que el envoltorio
anda, no para publicar.

Pendiente del dueno (plan v4, seccion 9): la **cuenta de Google Play** (USD 25, una vez). Recien ahi se crea
la app en Play Console, se prende Play App Signing y se carga su huella. Subir el AAB a la pista interna y
pasar a produccion es **siempre a mano**: el workflow no publica en la tienda.

## Que falta para que la app se pueda instalar

- Cuenta de Play y la ficha (fase 4: prueba cerrada con 12 personas, 14 dias).
- Que el manifiesto de la PWA tenga `id`, `screenshots` y `shortcuts` (auditoria previa, seccion 1 del plan):
  Play los pide para la ficha y Bubblewrap los usa para los atajos.
- Las alertas de precio (seccion 3.4): son el motivo para instalar la app y lo que evita el rechazo por
  «poca funcion».
