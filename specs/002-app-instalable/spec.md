# Feature Specification: App instalable que abre sin red

**Feature Branch**: `002-app-instalable`

**Created**: 2026-10-09

**Status**: Draft

**Input**: User description: "App instalable y que abre sin red (Fase 1, F1.5 de docs/plan-de-escalado.md). La Pichincha se puede instalar en el telefono y en la computadora como una app (icono propio en la pantalla de inicio, abre en su propia ventana, con el color del sitio), y despues de la primera visita abre sin conexion: muestra la ultima comparativa y los ultimos precios que bajo, diciendo con claridad de cuando son. Con conexion siempre se prefiere el dato nuevo: los precios no se pueden quedar viejos sin que la persona lo sepa (principio II de la constitucion). Las paginas por busqueda (/precios/...) tambien abren sin red si ya se visitaron. Cuando sale una version nueva del sitio, la app instalada la toma en la proxima apertura sin que la persona haga nada. No se agrega ninguna cuenta ni cookie ni aviso de permisos; no se muestra un cartel de instalar por nuestra cuenta (solo la opcion que ya ofrece el navegador). Se mide cuantas personas instalan la app con el mismo GoatCounter."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Instalar La Pichincha como una app (Priority: P1)

Una persona que usa La Pichincha seguido en el telefono la instala desde la opcion que ya ofrece
su navegador ("Instalar app" o "Agregar a la pantalla de inicio"). Queda un icono propio, se abre en
su propia ventana, sin la barra del navegador, y con el color del sitio.

**Why this priority**: es lo que pide el plan para quien vuelve seguido (Android) y lo que permite
medir quien se queda con la app. Sin esto no hay nada instalable.

**Independent Test**: abrir el sitio en un navegador que ofrezca instalar, instalarlo y abrirlo desde
el icono: tiene que verse como una app, con su nombre, icono y color.

**Acceptance Scenarios**:

1. **Given** una persona en el sitio con un navegador compatible, **When** abre el menu del navegador,
   **Then** ofrece instalar La Pichincha con su nombre, descripcion e icono.
2. **Given** la app instalada, **When** la abre desde el icono, **Then** se abre en su propia ventana,
   con el nombre "La Pichincha", el icono del sitio y la barra del color del sitio, en la pagina principal.
3. **Given** que el sitio se abre dentro del navegador, **When** la persona navega, **Then** no aparece
   ningun cartel ni ventana de instalacion armada por el sitio.

---

### User Story 2 - Abrir sin conexion con datos que dicen de cuando son (Priority: P1)

Una persona que ya visito el sitio esta en el subte, sin señal, y abre la app: ve la ultima comparativa
que armo y los ultimos precios que bajo, con un aviso claro de cuando son esos datos ("sin conexion:
precios del 9/10 a las 08:12"). Cuando vuelve la conexion, la app trae los datos nuevos.

**Why this priority**: es el segundo motivo de la feature. Y es donde un error cuesta mas: mostrar
precios viejos como si fueran de hoy rompe el principio II de la constitucion.

**Independent Test**: visitar el sitio, cortar la conexion, reabrir: carga con el aviso de sin
conexion y la fecha de los datos; con la conexion de vuelta, desaparece el aviso y se ven los precios nuevos.

**Acceptance Scenarios**:

1. **Given** una persona que ya visito el sitio, **When** lo abre sin conexion, **Then** carga la
   pagina principal y puede buscar sobre los ultimos precios que bajo.
2. **Given** que esta sin conexion, **When** mira cualquier precio, **Then** ve un aviso visible, sin
   tener que buscarlo, que dice que no hay conexion y de que fecha y hora son los precios.
3. **Given** que tiene conexion, **When** abre el sitio, **Then** siempre ve los datos mas nuevos: lo
   guardado solo se usa si el pedido a internet falla.
4. **Given** una persona que nunca visito el sitio y esta sin conexion, **When** lo abre, **Then** ve
   el aviso normal del navegador de que no hay conexion (no hay nada guardado).
5. **Given** que esta sin conexion, **When** toca un enlace a una tienda, **Then** pasa lo que pasaria
   con cualquier enlace sin conexion: el navegador avisa; la app no inventa una pagina de la tienda.

---

### User Story 3 - Las paginas por busqueda tambien abren sin red (Priority: P2)

Una persona entro desde Google a `/precios/ssd-1tb/` y despues se quedo sin señal. Si vuelve a
abrir esa pagina, o la comparativa de esa busqueda, la ve igual, con el mismo aviso de fecha.

**Why this priority**: las paginas por busqueda son la puerta de entrada nueva; que no se pierdan sin red
mejora la experiencia, pero es secundario frente al nucleo (US1 y US2).

**Independent Test**: visitar una pagina de `/precios/`, cortar la conexion y reabrirla.

**Acceptance Scenarios**:

1. **Given** una pagina por busqueda ya visitada, **When** se abre sin conexion, **Then** se ve completa,
   con el aviso de la fecha de sus precios.
2. **Given** una pagina por busqueda nunca visitada, **When** se abre sin conexion, **Then** se ve una
   pagina que dice que no esta disponible sin conexion y ofrece volver a la principal.

---

### User Story 4 - La app se mantiene al dia sola (Priority: P2)

Sale una version nueva del sitio (por ejemplo, la del dia con precios nuevos). La persona que tiene la
app instalada abre la app y ve la version nueva en esa apertura o en la siguiente, sin hacer nada,
sin cartel de "actualizar" y sin quedarse con una version vieja para siempre.

**Why this priority**: sin esto, la app instalada se queda congelada y empieza a mostrar cosas viejas
o rotas. Es lo que hace segura a las demas historias.

**Independent Test**: publicar un cambio visible, abrir la app instalada dos veces y verlo.

**Acceptance Scenarios**:

1. **Given** una app instalada y una version nueva publicada, **When** la persona la abre con conexion,
   **Then** a lo sumo en la apertura siguiente ve la version nueva.
2. **Given** una version nueva que cambio el formato de los datos, **When** la app se actualiza, **Then**
   no queda mezclada con datos del formato viejo ni con archivos de la version vieja.

---

### User Story 5 - Saber cuantas personas la instalan (Priority: P3)

El dueño ve en GoatCounter cuantas personas instalaron la app, sin cookies ni datos personales.

**Why this priority**: el principio V pide medir antes de seguir agregando; saber si la gente instala
decide si vale invertir mas en la app. Pero no cambia nada para quien usa el sitio.

**Independent Test**: instalar la app y ver el evento en el tablero.

**Acceptance Scenarios**:

1. **Given** una persona que instala la app, **When** termina la instalacion, **Then** se registra un
   evento de instalacion, una sola vez por instalacion.
2. **Given** una persona que abre la app ya instalada, **When** la abre, **Then** esa apertura se
   distingue de una visita al sitio en el navegador.

### Edge Cases

- Navegadores que no permiten instalar (por ejemplo, algunos de escritorio): el sitio funciona igual,
  sin errores ni mensajes.
- Un iPhone: se instala con "Agregar a pantalla de inicio" y abre con el icono y el nombre; la
  lectura sin conexion no se promete ahi si el navegador no la soporta, pero nada se rompe.
- La persona borra los datos del sitio o la app: vuelve a empezar como una primera visita.
- Los datos guardados superan cierta antiguedad (mas de 7 dias): el aviso lo dice con enfasis y
  no se presentan como utiles para comprar.
- El indice de precios no se pudo bajar con conexion (error del servidor): se usa lo guardado, con el aviso.
- La persona abre la app con una conexion muy lenta: no se queda esperando; ve lo guardado con el
  aviso de fecha mientras llegan los datos nuevos, y la pagina se actualiza sola cuando llegan.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sitio MUST poder instalarse como una app, con nombre "La Pichincha", descripcion,
  icono propio en los tamaños que piden los telefonos y las computadoras, color de la barra y de
  fondo del sitio, y apertura en su propia ventana.
- **FR-002**: El sitio MUST NOT mostrar ningun cartel, ventana ni boton propio para instalar: solo la
  opcion que ofrece el navegador.
- **FR-003**: Tras la primera visita con conexion, la pagina principal, sus estilos, sus scripts y el
  ultimo indice de precios bajado MUST abrir sin conexion.
- **FR-004**: Con conexion, el sitio MUST preferir siempre los datos nuevos: lo guardado solo se usa
  cuando el pedido a internet falla o no responde.
- **FR-005**: Sin conexion, la pagina MUST mostrar, sin que la persona tenga que buscarlo, un aviso
  que dice que no hay conexion y la fecha y hora de los precios que se estan viendo.
- **FR-006**: Si los datos guardados tienen mas de 7 dias, el aviso MUST decirlo con enfasis
  ("estos precios pueden estar viejos").
- **FR-007**: Las paginas de `/precios/` ya visitadas MUST abrir sin conexion con el mismo aviso; una
  no visitada MUST mostrar una pagina de "no disponible sin conexion" con enlace a la principal.
- **FR-008**: Una version nueva del sitio MUST ser tomada por la app instalada a mas tardar en la
  segunda apertura con conexion, sin accion de la persona y sin cartel.
- **FR-009**: Al actualizarse la app MUST descartar lo guardado de versiones anteriores, de modo que
  nunca mezcle archivos de dos versiones.
- **FR-010**: La app MUST NOT pedir permisos, crear cuentas ni usar cookies.
- **FR-011**: Se MUST registrar en GoatCounter un evento de instalacion, una vez por instalacion, y
  distinguir las aperturas de la app instalada de las visitas desde el navegador.
- **FR-012**: Los enlaces a tiendas MUST seguir funcionando igual que hoy y nunca guardarse como si
  fueran parte de la app.
- **FR-013**: La generacion diaria del sitio MUST seguir funcionando igual y publicar los archivos
  de la app sin pasos manuales; el tamaño de lo guardado para abrir sin conexion MUST ser razonable
  para un telefono con poco espacio (menos de 10 MB sin contar el indice, que ya pesa unos 2 MB).

### Key Entities

- **App instalada**: el sitio con su nombre, icono, color y modo de apertura.
- **Version guardada**: el conjunto de archivos de una publicacion que quedan en el dispositivo, con su
  numero de version; solo hay una activa.
- **Datos guardados**: el ultimo indice de precios bajado y la fecha y hora en que se genero.
- **Aviso de sin conexion**: lo que dice que no hay conexion y de cuando son los datos.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En un navegador compatible, la opcion de instalar aparece sin que el sitio haga nada y la
  app instalada abre en su propia ventana con su icono y color.
- **SC-002**: Despues de una visita con conexion, el 100% de las aperturas sin conexion cargan la pagina
  principal con el aviso y la fecha de los precios, en menos de 2 segundos.
- **SC-003**: Con conexion, el 100% de las aperturas muestran los datos nuevos; ninguna muestra datos
  guardados cuando la conexion funciona.
- **SC-004**: Una version nueva llega a la app instalada a mas tardar en la segunda apertura con
  conexion, en el 100% de las pruebas.
- **SC-005**: Lo que se guarda para abrir sin conexion pesa menos de 10 MB sin el indice.
- **SC-006**: A las 4 semanas de publicar, el tablero muestra cuantas personas la instalaron y cuantas
  aperturas vienen de la app (meta: saber el numero, no alcanzar una cifra).
- **SC-007**: El sitio en el navegador no tiene ningun cambio visible ni mas lento para quien no
  instala nada: el tiempo de carga con conexion no empeora.

## Assumptions

- El icono se arma a partir de la imagen y los colores del sitio; no hay un logo oficial todavia.
- La lectura sin conexion depende del navegador: se promete donde el navegador la soporta, y donde
  no, el sitio sigue funcionando como hoy.
- "Abre sin conexion" incluye buscar sobre el ultimo indice guardado; no incluye precios nuevos, fotos
  de tiendas ni los enlaces a tiendas.
- Las fotos de las tiendas no se guardan (son de terceros y pesan); sin conexion las tarjetas muestran
  el espacio sin foto, como cuando una tienda no la tiene.
- Las notificaciones y las alertas de precio no forman parte (son de la Fase 3 y 4).
- Los precios son con IVA y sin envio, como en el resto del sitio; el texto va en español rioplatense.
