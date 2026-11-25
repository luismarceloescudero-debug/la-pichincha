# Politica de bajas de tiendas (decision del dueno, 25/11/2026)

Una tienda que nos bloquea no se esquiva (constitucion, principio III). Lo que se hace con cada bloqueo:

| Cuando | Que pasa | Quien |
|---|---|---|
| **Primer bloqueo** (hoy: Katech y Mercado Libre, 25/11) | Esa corrida la descarta: se muestran sus precios de la corrida anterior marcados con fecha vieja. Aviso privado por Telegram y issue «Fuente con pocos productos». No se insiste ese dia. | automatico (`estado_tiendas.py`) |
| **Segundo bloqueo seguido** (26/11 para las dos) | Se anota en el issue de la tienda como «reincidente» y se mira si hay otro camino legitimo (API oficial, feed propio). Sigue descartada cada dia que bloquea. | quien lea el issue (Claude o el dueno) |
| **14 dias seguidos sin productos** | Pausa automatica: sus precios viejos dejan de publicarse (`DIAS_PAUSA` en `estado_tiendas.py`). | automatico |
| **30 dias sin historial util** (ninguna corrida con productos en un mes) | Se **propone la baja**: se saca de `tiendas.json`, se avisa al dueno y se registra aca y en el issue. Decide el dueno. | dueno |

Reglas:
- La baja no borra el historial ya publicado; solo deja de pedirse la tienda.
- Una tienda dada de baja puede volver si abre una API o deja de bloquear: se prueba una vez por trimestre con un pedido, no mas.
- Mercado Libre tiene ademas su propia regla para el 429 (ver `mercadolibre.py` y la memoria «API de Mercado Libre»).

## Seguimiento abierto

| Tienda | Primer bloqueo | Segundo seguido | Limite de 30 dias sin historial |
|---|---|---|---|
| Katech | 25/11/2026 | 26/11 (a confirmar) | 25/12/2026 |
| Mercado Libre | 25/11/2026 | 26/11 (a confirmar) | 25/12/2026 |
