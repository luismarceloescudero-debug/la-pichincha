const test = require("node:test");
const assert = require("node:assert/strict");
const App = require("../../js/app.js");

const AHORA = new Date("2026-10-09T12:00:00-03:00");

// ---- El aviso de sin conexion ----

test("sin conexion dice de cuando son los precios, en hora argentina", () => {
  const a = App.avisoSinRed("2026-10-09T08:12-03:00", AHORA);
  assert.match(a.texto, /^Sin conexión/);
  assert.match(a.texto, /hoy 08:12/);
  assert.equal(a.viejo, false);
  assert.match(App.avisoSinRed("2026-10-08T23:59-03:00", AHORA).texto, /ayer 23:59/);
});

test("pasados 7 dias avisa con enfasis que pueden estar viejos", () => {
  const justo = App.avisoSinRed("2026-10-02T12:00-03:00", AHORA);          // exactamente 7 dias
  assert.equal(justo.viejo, false);
  const viejo = App.avisoSinRed("2026-10-01T08:12-03:00", AHORA);
  assert.equal(viejo.viejo, true);
  assert.match(viejo.texto, /pueden estar viejos/i);
  assert.match(viejo.texto, /1\/10/);
});

test("sin fecha o con una fecha invalida avisa igual, sin inventar una", () => {
  for (const g of [undefined, null, "", "basura"]) {
    const a = App.avisoSinRed(g, AHORA);
    assert.match(a.texto, /^Sin conexión/);
    assert.doesNotMatch(a.texto, /NaN|undefined|Invalid/);
    assert.equal(a.viejo, false);
  }
});

test("un indice viejo que trae solo la fecha tambien se entiende", () => {
  assert.match(App.avisoSinRed("2026-10-07", AHORA).texto, /el 7\/10/);
});

// ---- El entorno simulado: ventana, documento y red ----

function entorno({ serviceWorker = true, sonda = "ok", standalone = false, goatcounter = true, generado = "2026-10-09T08:12-03:00" } = {}) {
  const escuchas = {}, temporizadores = [], registros = [], eventos = [];
  const aviso = { hidden: true, textContent: "", dataset: {} };
  const ventana = {
    navigator: serviceWorker ? { serviceWorker: { register: async (ruta) => { registros.push(ruta); } } } : {},
    addEventListener: (tipo, fn) => { escuchas[tipo] = fn; },
    matchMedia: () => ({ matches: standalone }),
    fetch: async (url, opciones) => {
      ventana.pedidos.push({ url, ...opciones });
      if (sonda === "falla") throw new TypeError("sin red");
      if (sonda === "cuelga") return new Promise(() => {});
      return { ok: true };
    },
    pedidos: [],
    setTimeout: (fn, ms) => { temporizadores.push({ fn, ms }); return temporizadores.length; },
    clearTimeout: () => {},
    sessionStorage: (() => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; })(),
    goatcounter: goatcounter ? { count: e => eventos.push(e.path) } : undefined,
  };
  const documento = { getElementById: id => id === "sin-red" ? aviso : null };
  const app = App.iniciar(ventana, documento, { sw: "sw.js", sonda: "manifest.webmanifest", generado: () => generado, ahora: () => AHORA });
  return { ventana, documento, aviso, escuchas, temporizadores, registros, eventos, app };
}
const esperar = () => new Promise(r => setImmediate(r));

// ---- Service worker: se registra despues de cargar y solo si el navegador lo soporta ----

test("registra el service worker despues de cargar, no antes", async () => {
  const { escuchas, registros } = entorno();
  assert.deepEqual(registros, [], "antes de load no pasa nada: cero costo para la carga");
  escuchas.load();
  await esperar();
  assert.deepEqual(registros, ["sw.js"]);
});

test("sin soporte de service worker no hay errores ni aviso", async () => {
  const { escuchas, aviso } = entorno({ serviceWorker: false });
  assert.doesNotThrow(() => escuchas.load());
  await esperar();
  assert.equal(aviso.hidden, true);
});

// ---- El aviso se muestra solo cuando de verdad no hay conexion ----

test("con conexion el aviso no aparece", async () => {
  const { escuchas, aviso, ventana } = entorno({ sonda: "ok" });
  escuchas.load();
  await esperar(); await esperar();
  assert.equal(aviso.hidden, true);
  assert.equal(ventana.pedidos[0].method, "HEAD", "el HEAD llega a la red: el service worker no lo atiende");
  assert.equal(ventana.pedidos[0].cache, "no-store");
});

test("si el pedido de prueba falla, aparece el aviso con la fecha de los precios", async () => {
  const { escuchas, aviso } = entorno({ sonda: "falla" });
  escuchas.load();
  await esperar(); await esperar();
  assert.equal(aviso.hidden, false);
  assert.match(aviso.textContent, /Sin conexión.*hoy 08:12/);
});

test("si el pedido de prueba no responde en 5 segundos tambien aparece", async () => {
  const { escuchas, aviso, temporizadores } = entorno({ sonda: "cuelga" });
  escuchas.load();
  await esperar();
  const limite = temporizadores.find(t => t.ms === 5000);
  assert.ok(limite, "hay un limite de 5 s");
  limite.fn();
  await esperar();
  assert.equal(aviso.hidden, false);
});

test("los eventos offline y online lo muestran y lo ocultan", async () => {
  const { escuchas, aviso } = entorno({ sonda: "ok" });
  escuchas.offline();
  assert.equal(aviso.hidden, false);
  escuchas.online();
  await esperar(); await esperar();
  assert.equal(aviso.hidden, true);
});

test("el aviso toma la fecha de los precios en el momento de mostrarse", async () => {
  let generado;
  const e = entorno({ sonda: "falla" });
  // misma app con una fecha que cambia: primero sin indice y despues con indice
  const aviso = e.aviso;
  const ventana = e.ventana;
  const app = App.iniciar(ventana, e.documento, { sw: "sw.js", sonda: "m", generado: () => generado, ahora: () => AHORA });
  app.mostrarAviso();
  assert.doesNotMatch(aviso.textContent, /hoy/);
  generado = "2026-10-09T08:12-03:00";
  app.mostrarAviso();
  assert.match(aviso.textContent, /hoy 08:12/);
});

test("si la pagina no tiene el contenedor del aviso, no se cae", async () => {
  const ventana = entorno().ventana;
  const app = App.iniciar(ventana, { getElementById: () => null }, { sw: "sw.js", sonda: "m", generado: () => "", ahora: () => AHORA });
  assert.doesNotThrow(() => app.mostrarAviso());
});

// ---- La medicion de la instalacion ----

test("appinstalled registra app/instalada una sola vez", async () => {
  const { escuchas, eventos } = entorno();
  escuchas.appinstalled();
  escuchas.appinstalled();
  assert.deepEqual(eventos, ["app/instalada"]);
});

test("en modo app registra app/abierta una vez por sesion; en el navegador comun, ninguna", async () => {
  const comun = entorno({ standalone: false });
  comun.escuchas.load(); await esperar();
  assert.deepEqual(comun.eventos, []);
  const app = entorno({ standalone: true });
  app.escuchas.load(); await esperar();
  app.escuchas.load(); await esperar();
  assert.deepEqual(app.eventos, ["app/abierta"]);
});

test("sin GoatCounter no hay errores al medir", async () => {
  const { escuchas } = entorno({ goatcounter: false, standalone: true });
  assert.doesNotThrow(() => { escuchas.load(); escuchas.appinstalled(); });
});

test("nunca pide permisos ni escucha beforeinstallprompt", () => {
  const { escuchas } = entorno();
  assert.equal(escuchas.beforeinstallprompt, undefined);
});
