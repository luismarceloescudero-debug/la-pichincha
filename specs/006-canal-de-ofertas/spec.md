# Feature Specification: Canal de ofertas (RSS y Telegram)

**Feature Branch**: `006-canal-de-ofertas`

**Created**: 2026-10-09

**Status**: Implemented (Telegram inactivo hasta cargar los secretos)

**Input**: Fase 3, F3.1 de docs/plan-de-escalado.md: "Canal de Telegram automatico 'Pichinchas del dia', publicado por la misma Action con la API de bots, y un RSS de ofertas como archivo estatico. Ninguno de los dos necesita backend." Regla fija (F3.2): el orden nunca depende de comisiones; todo se rotula.

## User Scenarios & Testing

### User Story 1 - Seguir las ofertas con un lector de RSS (Priority: P1)

Una persona agrega `ofertas.xml` a su lector de noticias y cada dia recibe las mejores ofertas del sitio: nombre, precio de hoy,
cuanto bajo, comercio y enlace a la tienda, con la hora de los precios.

**Independent Test**: generar el feed con un indice de prueba y validar que es un RSS 2.0 bien formado, con una entrada por oferta,
enlaces `http(s)` a la tienda y todo el texto escapado.

**Acceptance Scenarios**:

1. **Given** un indice con bajas de precio y rebajas publicadas, **When** se genera el feed, **Then** `ofertas.xml` trae hasta 20
   entradas, las bajas propias primero y despues las rebajas publicadas, cada una con titulo, enlace, descripcion y fecha.
2. **Given** un aviso cuyo enlace no es `http(s)`, **Then** no entra al feed.
3. **Given** que no hay ofertas, **Then** el feed igual sale, vacio y valido.
4. **Given** una compra internacional, **Then** no entra al feed (no es comparable con el resto).

### User Story 2 - "Pichinchas del dia" en Telegram (Priority: P2)

Cada dia, la Action publica en un canal de Telegram un mensaje con las mejores ofertas del dia y un enlace al sitio. Si el canal
no esta configurado (no hay token), no pasa nada y la corrida sigue.

**Independent Test**: con un servidor de Telegram de mentira, el mensaje sale con las ofertas, el formato correcto y el enlace; sin
token no se hace ningun pedido.

**Acceptance Scenarios**:

1. **Given** el token y el canal en los secretos, **When** corre la Action programada, **Then** se envia un mensaje con hasta 10 ofertas
   y el enlace al sitio.
2. **Given** que no hay token, **Then** el paso se saltea sin error.
3. **Given** que la API de Telegram falla, **Then** el sitio se publica igual y el paso avisa con una advertencia.
4. **Given** que no hay ofertas, **Then** no se envia nada.

## Requirements

- **FR-001**: La seleccion de ofertas DEBE ser la misma logica que usa la pestaña Ofertas (`calcularOfertas`), compartida en un modulo
  puro de `js/`, no copiada.
- **FR-002**: Las ofertas del feed y del canal DEBEN ordenarse por señal confiable: primero las bajas propias (del historial), despues
  las rebajas publicadas; dentro de cada grupo, por porcentaje de descuento. El orden no depende de comisiones.
- **FR-003**: Se excluyen las compras internacionales y los avisos sin enlace `http(s)`.
- **FR-004**: Cada entrada dice cuando son los precios (principio II) y recuerda verificar en la tienda.
- **FR-005**: Todo texto de terceros va escapado (XML en el feed, HTML en Telegram).
- **FR-006**: El feed se publica como archivo estatico (`ofertas.xml`) y se anuncia en el `<head>` de las paginas con
  `<link rel="alternate" type="application/rss+xml">`.
- **FR-007**: El publicador de Telegram DEBE ser opcional: sin `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` no hace pedidos ni falla; en la Action
  solo corre en la corrida programada.
- **FR-008**: Ningun enlace del feed ni del canal lleva codigos de afiliado todavia (F3.2 los agregara rotulados).

## Success Criteria

- **SC-001**: `ofertas.xml` pasa una validacion de RSS 2.0 y se abre en un lector real.
- **SC-002**: Con el canal configurado, el mensaje diario sale sin pasos manuales.
- **SC-003**: Sin configurar, la corrida no cambia su duracion ni su resultado.

## Assumptions

- Crear el bot (con @BotFather) y el canal, y cargar `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` como secretos del repo lo hace el dueño: es una cuenta
  suya. La feature queda lista e inactiva hasta entonces.
- "Pichinchas del dia" son las 10 mejores del feed; el nombre del canal lo elige el dueño.
- Una corrida manual o de push no publica en Telegram, para no repetir mensajes.
