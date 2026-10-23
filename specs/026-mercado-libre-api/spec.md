# Feature Specification: Mercado Libre directo por su API oficial

**Created**: 2026-10-23

**Status**: Implementada. Entra al indice en la corrida diaria (`actualizar.yml`, paso "Armar el indice de busqueda").

**Input**: Punto B2 de `docs/plan-v2.md`. El dueño eligio traer Mercado Libre directo por la API oficial, con la app de
desarrollador que ya tenia (secretos `ML_CLIENT_ID` y `ML_CLIENT_SECRET`), en lugar de leer los canales de afiliados de
Telegram o WhatsApp, que traen sobre todo productos que no son hardware. Hasta ahora Mercado Libre llegaba solo por
ComparaYa, con precios que a veces estaban viejos (spec de verificacion, 19/10).

## Lo medido (23/10, corridas de Actions con el token de aplicacion)

El token es de aplicacion (`client_credentials`), sin cuenta de usuario.

| Endpoint | Con token | Sin token |
|---|---|---|
| `/sites/MLA/search` (por categoria o termino) | **403** | 403 |
| `/highlights/MLA/category/...` (mas vendidos) | **403** (`PA_UNAUTHORIZED_RESULT_FROM_POLICIES`) | 401 |
| `/products/search?site_id=MLA&q=...` (catalogo) | 200 | 403 |
| `/products/search` con `domain_id` | 200: solo ese dominio | - |
| `/products/{id}` | 200 (`permalink` vacio, `buy_box_winner` null) | 401 |
| `/products/{id}/items` | 200: cada vendedor con `price`, `original_price`, `condition`, `currency_id`, `international_delivery_mode` | 403 |
| `/sites/MLA/domain_discovery/search` | 200 | 200 |
| `/trends/MLA/{categoria}` | 200 (terminos, sin precios) | 403 |

- `/products/search` acepta hasta `limit=100` y no pagina mas alla de 200 (`offset` mas alto: 400).
- Sin `domain_id` la busqueda mezcla dominios («monitor» trae monitores de bebe y tensiometros; «ssd», gabinetes
  externos): cada rubro va con su dominio, sacado de `domain_discovery`.
- De cada 100 productos del catalogo, entre 1 (celulares) y 35 (motherboards) tienen un vendedor activo: el catalogo
  incluye productos que hoy nadie vende.
- A unos 4.000 pedidos por minuto la API respondio **429**, y el castigo dura mas de 30 segundos.

## Decisiones

- **Fuente nueva `mercadolibre`** en `tiendas.json`, `catalogo.tipo: "mercadolibre"`, leida por `mercadolibre.py`.
  14 rubros (`q` y `dominio`): notebook, monitor, placa de video, procesador, memoria RAM, SSD, motherboard, fuente,
  gabinete, celular, teclado mecanico, mouse gamer, auriculares gamer y webcam. Hasta 200 productos por rubro.
- **Un producto, un aviso**: el vendedor mas barato que lo vende **nuevo, en pesos y desde Argentina**. Es el mismo
  criterio con el que `verificar_ofertas.py` decide si una oferta de Mercado Libre sigue en pie (alguien lo vende al
  precio publicado). El tachado es el `original_price` de ese vendedor, solo si es mas alto; nunca uno inventado
  (`lista_es_oferta: true`, como ComparaYa).
- **La direccion** es la de la ficha, `https://www.mercadolibre.com.ar/<texto>/p/MLA...`, con el texto armado como lo
  arma Mercado Libre (sin tildes ni signos, palabras con guiones): coincide con la que publica ComparaYa.
- **Sin duplicados con ComparaYa**: `indexar.clave_aviso` reconoce un producto de catalogo por su numero (`/p/MLA...`)
  y `sin_repetir_agregador` saca la copia del agregador, que puede traer un precio viejo.
- **Marca y codigo**: la marca (`BRAND`) se suma al nombre si falta (`nombre_enriquecido`); el part number
  (`PART_NUMBER` o `ALPHANUMERIC_MODEL`) entra como codigo de modelo si tiene forma de codigo (`modelo.modelo_de_api`).
- **Ritmo**: 4 pedidos en paralelo con 0,2 segundos de pausa en cada uno. Un 429 se espera 30 segundos y se reintenta
  una vez; un segundo 429 o un 403 cortan la fuente sin insistir, y `indexar.py` reusa lo de la corrida anterior
  (principio III). Un producto que no responde queda afuera; la busqueda que ya no pagina corta ese rubro.
- **Sin los secretos** la fuente falla sola (como una tienda caida) y el resto del indice sale igual.
- El codigo de afiliado lo suma `Pagina.enlaceTienda` (spec 025) a cualquier link de mercadolibre.com.ar: esta fuente
  no lo toca.

## Resultado (23/10, solo Mercado Libre)

350 productos en 4 minutos 17 segundos, sin 429: 68 con precio anterior y 70 con codigo de modelo. Por rubro:
notebook 5, monitor 12, placa de video 19, procesador 54, memoria RAM 20, SSD 8, motherboard 68, fuente 29, gabinete
26, celular 1, teclado 26, mouse 12, auriculares 20, webcam 50.

## Pendiente

- Notebooks y celulares rinden poco con un termino tan general: probar terminos mas precisos por rubro (por ejemplo,
  por linea o procesador) y medir cuantos productos con vendedor suma cada uno.
- `/highlights` (mas vendidos) y `/sites/MLA/search` piden mas que el token de aplicacion. Si alguna vez hace falta,
  se mide con el token de usuario del dueño (OAuth), no se esquiva.

## Tests

`tests/test_mercadolibre.py` (21): el vendedor elegido (nuevo, pesos, Argentina, precio anterior solo si es mas alto),
el aviso (direccion, foto, marca, codigo), el recorrido por rubro (dominio, paginas de 100, tope, `--max-paginas`,
corte donde la API deja de paginar), un producto que no responde, un bloqueo que corta, el token, la pausa, el
reintento ante un 429 y la copia de ComparaYa del mismo `/p/MLA...`.
