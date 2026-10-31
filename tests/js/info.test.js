const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const I = require("../../generar_info.js");

const BASE = "https://ejemplo.test/la-pichincha";
const fila = (nombre, tienda) => [nombre, 1000, "https://t.test/" + nombre, tienda, "", 0, 0, "", "", ""];
const IDX = {
  generado: "2026-10-14T09:10-03:00",
  tiendas: {
    compragamer: { nombre: "CompraGamer", relevado: "2026-10-14T09:10-03:00" },
    fullh4rd: { nombre: "FullH4rd", relevado: "2026-10-07T09:05-03:00" },
    nueva: { nombre: "Tienda <Nueva>" },
    comparaya: { nombre: "ComparaYa", relevado: "2026-10-14T09:10-03:00", segunda: true },
  },
  productos: [fila("a", "compragamer"), fila("b", "compragamer"), fila("c", "fullh4rd"), fila("d", "comparaya")],
};
const SALUD = {
  fecha: "2026-10-14T09:10-03:00",
  fuentes: {
    compragamer: { nombre: "CompraGamer", previo: 2000, ahora: 1200, estado: "baja" },
    fullh4rd: { nombre: "FullH4rd", previo: 1500, ahora: 0, estado: "fallo" },
  },
};

test("cada fuente sale con sus avisos, su ultimo relevamiento y un estado", () => {
  const filas = I.estadoFuentes(IDX, null);
  const por = Object.fromEntries(filas.map(f => [f.clave, f]));
  assert.deepEqual(por.compragamer, { clave: "compragamer", nombre: "CompraGamer", avisos: 2,
    relevado: "2026-10-14T09:10-03:00", estado: "ok", segunda: false });
  assert.equal(por.fullh4rd.estado, "atrasada");          // sin salud.json, lo dice la fecha
  assert.equal(por.nueva.estado, "sin-datos");
  assert.equal(por.nueva.avisos, 0);
  assert.equal(por.comparaya.segunda, true);
});

test("un indice anterior a tiendas.relevado toma la fecha del indice para las fuentes con avisos", () => {
  const viejo = { ...IDX, tiendas: { compragamer: { nombre: "CompraGamer" }, nueva: { nombre: "Nueva" } } };
  const por = Object.fromEntries(I.estadoFuentes(viejo, null).map(f => [f.clave, f]));
  assert.equal(por.compragamer.estado, "ok");
  assert.equal(por.compragamer.relevado, IDX.generado);
  assert.equal(por.nueva.estado, "sin-datos");             // sin avisos ni fecha: de verdad no se relevo
});

test("con salud.json de la misma corrida, manda el estado medido", () => {
  const por = Object.fromEntries(I.estadoFuentes(IDX, SALUD).map(f => [f.clave, f]));
  assert.equal(por.compragamer.estado, "baja");
  assert.equal(por.fullh4rd.estado, "fallo");
  assert.equal(por.comparaya.estado, "ok");               // no figura en salud: se juzga por la fecha
});

test("un salud.json de otra corrida no pisa lo que dice el indice", () => {
  const viejo = { ...SALUD, fecha: "2026-10-13T09:00-03:00" };
  const por = Object.fromEntries(I.estadoFuentes(IDX, viejo).map(f => [f.clave, f]));
  assert.equal(por.compragamer.estado, "ok");
  assert.equal(por.fullh4rd.estado, "atrasada");
});

test("primero las fuentes con problemas, despues las que estan al dia", () => {
  const orden = I.estadoFuentes(IDX, SALUD).map(f => f.clave);
  assert.deepEqual(orden, ["fullh4rd", "nueva", "compragamer", "comparaya"]);
});

test("la pagina /estado/ dice la hora de cada fuente en hora argentina y escapa los nombres", () => {
  const html = I.renderEstado(IDX, SALUD, { baseUrl: BASE });
  assert.match(html, /<title>Estado de las fuentes \| La Pichincha<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/estado\/">/);
  assert.match(html, /Precios del 14\/10 09:10/);
  assert.match(html, /FullH4rd[\s\S]*?No respondió[\s\S]*?7\/10 09:05/);
  assert.match(html, /CompraGamer[\s\S]*?Trajo menos de lo habitual/);
  assert.match(html, /Tienda &lt;Nueva&gt;[\s\S]*?Todavía sin relevar/);
  assert.ok(!html.includes("<Nueva>"));
  assert.match(html, /href="\.\.\/legal\/"/);
  assert.match(html, /\.info table[^<]*<\/style>\n<\/head>/);    // el estilo propio va dentro del head
});

test("la pagina legal cubre terminos, privacidad sin cookies y afiliados rotulados", () => {
  const html = I.renderLegal({ baseUrl: BASE });
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/legal\/">/);
  for (const id of ["terminos", "privacidad", "afiliados"]) assert.match(html, new RegExp(`<h2 id="${id}">`));
  assert.match(html, /GoatCounter/);
  assert.match(html, /sin cookies/);
  assert.match(html, /nunca depende de una comisión/);
});

test("main escribe /estado/ y /legal/; sin indice escribe solo /legal/", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "info-"));
  const indice = path.join(dir, "indice.json");
  const salud = path.join(dir, "salud.json");
  fs.writeFileSync(indice, JSON.stringify(IDX));
  fs.writeFileSync(salud, JSON.stringify(SALUD));
  const salida = path.join(dir, "sitio");
  I.main(["--indice", indice, "--salud", salud, "--salida", salida, "--base-url", BASE]);
  assert.match(fs.readFileSync(path.join(salida, "estado", "index.html"), "utf8"), /No respondió/);
  assert.ok(fs.existsSync(path.join(salida, "legal", "index.html")));

  const solo = path.join(dir, "solo");
  I.main(["--indice", path.join(dir, "no-hay.json"), "--salud", path.join(dir, "tampoco.json"), "--salida", solo, "--base-url", BASE]);
  assert.ok(!fs.existsSync(path.join(solo, "estado")));
  assert.ok(fs.existsSync(path.join(solo, "legal", "index.html")));
});

test("la privacidad explica lo más buscado con el mismo mínimo y la misma ventana que usa el código", () => {
  const Buscadas = require("../../js/buscadas.js");
  const html = I.renderLegal({ baseUrl: BASE });
  assert.match(html, /Lo más buscado/);
  assert.ok(html.includes(`al menos ${Buscadas.MINIMO_VISITANTES} personas distintas`));
  assert.ok(html.includes(`últimos ${Buscadas.VENTANA_DIAS} días`));
  assert.match(html, /sin conteos, sin fechas y sin nada de quién buscó/);
  assert.match(html, /datos personales/);
});

/* --- Spec 046: /contacto/, /acerca/ y security.txt --- */
const cargarWorker = () => import(path.join(__dirname, "..", "..", "worker", "src", "index.js").replace(/\\/g, "/").replace(/^([A-Za-z]):/, "file:///$1:"));

test("contacto: los limites y los motivos de la pagina son los mismos que valida el Worker", async () => {
  const W = await cargarWorker();
  assert.equal(I.CONTACTO.nombre, W.LARGOS.nombre);
  assert.equal(I.CONTACTO.correo, W.LARGOS.correo);
  assert.equal(I.CONTACTO.mensajeMin, W.LARGOS.mensajeMin);
  assert.equal(I.CONTACTO.mensaje, W.LARGOS.mensaje);
  assert.equal(I.CONTACTO.esperaMin, W.ESPERA_MIN_MS);
  assert.deepEqual(I.MOTIVOS.map(m => m[0]), Object.keys(W.MOTIVOS));
});

test("contacto: formulario accesible, con el endpoint del Worker, campo trampa y estados anunciados", () => {
  const html = I.renderContacto({ baseUrl: BASE, workerUrl: "https://afuera.example.workers.dev/" });
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/contacto\/">/);
  assert.match(html, /data-endpoint="https:\/\/afuera\.example\.workers\.dev\/contacto"/);
  for (const id of ["nombre", "correo", "motivo", "mensaje"]) {
    assert.match(html, new RegExp(`<label for="${id}">`), "label de " + id);
    assert.match(html, new RegExp(`id="${id}"[^>]*aria-describedby="[^"]*error-${id}`), "error asociado a " + id);
  }
  assert.match(html, /id="correo"[^>]*type="email"[^>]*required/);
  assert.match(html, /id="estado" role="status" aria-live="polite"/);
  assert.match(html, /class="trampa" aria-hidden="true"[\s\S]*?id="sitio" name="sitio" type="text" tabindex="-1" autocomplete="off"/);
  assert.match(html, /<fieldset id="campos" disabled>/, "sin JS el formulario queda deshabilitado");
  assert.match(html, /<noscript>[^<]*<p[^>]*>Este formulario necesita JavaScript/);
  for (const t of ["Enviando el mensaje", "Tu mensaje se envió", "No se pudo"]) assert.ok(html.includes(t), t);
  assert.match(html, /espera: Date\.now\(\) - inicio/);
  assert.match(html, /href="\.\.\/legal\/#contacto"/);
  assert.match(html, /<option value="error">Un precio o dato mal<\/option>/);
});

test("contacto: sin direccion del Worker el formulario dice que no esta disponible y no apunta a ningun lado", () => {
  const html = I.renderContacto({ baseUrl: BASE, workerUrl: "" });
  assert.match(html, /data-endpoint=""/);
  assert.match(html, /no está disponible en este momento/);
});

test("contacto: por defecto usa la direccion del Worker de sitio.json, que ya esta en connect-src de la CSP", () => {
  const sitio = require("../../sitio.json");
  const html = I.renderContacto();
  assert.ok(html.includes(`data-endpoint="${sitio.afuera_url}/contacto"`));
  assert.ok(sitio.csp.includes(`connect-src 'self' ${sitio.afuera_url}`));
});

test("acerca: dice la filosofia del sitio, sin datos personales ni marcas pendientes, y el contacto es el formulario", () => {
  const html = I.renderAcerca({ baseUrl: BASE });
  assert.match(html, /<link rel="canonical" href="https:\/\/ejemplo\.test\/la-pichincha\/acerca\/">/);
  assert.doesNotMatch(html, /\[COMPLETAR/);
  assert.match(html, /ofertas reales de hardware/);
  assert.match(html, /lo mejor, al mejor costo posible/);
  assert.match(html, /href="\.\.\/contacto\/"/);
  assert.doesNotMatch(html, /@[a-z0-9-]+\.[a-z]/i, "ningun correo publicado");
});

test("security.txt: Contact es el formulario y Expires vence a un año (RFC 9116)", () => {
  const txt = I.securityTxt({ baseUrl: BASE, ahora: new Date("2026-10-30T15:00:00Z") });
  assert.equal(txt, "Contact: https://ejemplo.test/la-pichincha/contacto/\nExpires: 2027-10-30T03:00:00Z\n" +
    "Preferred-Languages: es, en\nCanonical: https://ejemplo.test/la-pichincha/.well-known/security.txt\n");
});

test("las paginas de informacion enlazan contacto en el pie y la privacidad explica el formulario", () => {
  assert.match(I.renderLegal({ baseUrl: BASE }), /href="\.\.\/contacto\/">Contacto<\/a>/);
  assert.match(I.renderLegal({ baseUrl: BASE }), /<p id="contacto"><b>Formulario de contacto\.<\/b>/);
  assert.doesNotMatch(I.renderLegal({ baseUrl: BASE }), /no tiene cuentas ni formularios/);
  assert.match(I.renderEstado(IDX, SALUD, { baseUrl: BASE }), /href="\.\.\/contacto\/">Contacto<\/a>/);
  const portada = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  assert.match(portada, /<a href="legal\/">Términos, privacidad y afiliados<\/a> · <a href="contacto\/">Contacto<\/a>/);
});

test("main escribe /contacto/, /acerca/ y /.well-known/security.txt aunque no haya indice", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "info-"));
  I.main(["--indice", path.join(dir, "no-hay.json"), "--salud", path.join(dir, "tampoco.json"), "--salida", dir, "--base-url", BASE]);
  assert.match(fs.readFileSync(path.join(dir, "contacto", "index.html"), "utf8"), /<h1>Contacto<\/h1>/);
  assert.match(fs.readFileSync(path.join(dir, "acerca", "index.html"), "utf8"), /<h1>Acerca de La Pichincha<\/h1>/);
  assert.match(fs.readFileSync(path.join(dir, ".well-known", "security.txt"), "utf8"), /^Contact: https:\/\/ejemplo\.test\/la-pichincha\/contacto\/\n/);
});
