/* Spec 052: el JSON-LD de la portada, /acerca/ y /precios/<slug>/ es valido, usa solo tipos y propiedades de schema.org
   que Google acepta, y las referencias por @id se resuelven contra las paginas que definen la organizacion y el servicio. */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const A = require("../../js/analisis.js");
const G = require("../../generar_paginas.js");
const Info = require("../../generar_info.js");
const SITIO = require("../../sitio.json");

const BASE = SITIO.base_url.replace(/\/$/, "");
const IDS = G.idsDelSitio(BASE);

const bloques = html => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
const grafoDe = html => {
  const b = bloques(html);
  assert.equal(b.length, 1, "un solo bloque JSON-LD");
  assert.equal(b[0]["@context"], "https://schema.org");
  return b[0]["@graph"];
};

/* Tipos que el sitio puede usar; cualquier otro (Product, Offer, Review...) hace fallar la prueba. */
const TIPOS_OK = new Set(["Organization", "Service", "WebSite", "SearchAction", "Country", "AboutPage", "CollectionPage",
  "ItemList", "ListItem", "BreadcrumbList"]);
const PROPIEDADES_OK = {
  Organization: ["name", "url", "logo"], Service: ["name", "serviceType", "description", "url", "areaServed", "provider"],
  WebSite: ["name", "url", "inLanguage", "publisher", "potentialAction"], AboutPage: ["url", "name", "inLanguage", "isPartOf", "about"],
  CollectionPage: ["url", "name", "inLanguage", "isPartOf", "about", "mainEntity", "breadcrumb"],
  ItemList: ["name", "numberOfItems", "itemListElement"], BreadcrumbList: ["itemListElement"],
};

function revisar(nodos, { definidos = [] } = {}) {
  const ids = new Set([...definidos, ...nodos.filter(n => n["@id"]).map(n => n["@id"])]);
  const recorrer = v => {
    if (Array.isArray(v)) return v.forEach(recorrer);
    if (!v || typeof v !== "object") return;
    if (v["@type"]) assert.ok(TIPOS_OK.has(v["@type"]), `tipo no previsto: ${v["@type"]}`);
    if (Object.keys(v).length === 1 && v["@id"]) assert.ok(ids.has(v["@id"]), `@id sin resolver: ${v["@id"]}`);
    Object.values(v).forEach(recorrer);
  };
  nodos.forEach(n => {
    const ok = PROPIEDADES_OK[n["@type"]];
    if (ok) for (const k of Object.keys(n)) assert.ok(["@type", "@id", ...ok].includes(k), `${n["@type"]}.${k} no esta previsto`);
    recorrer(n);
  });
  const texto = JSON.stringify(nodos);
  for (const k of ["Product", "Offer", "AggregateOffer", "aggregateRating", "review", "availability", "email", "telephone"])
    assert.ok(!texto.includes(`"${k}"`) && !texto.includes(`"@type":"${k}"`), k);
}

function servicioYOrganizacion(nodos) {
  const org = nodos.find(n => n["@type"] === "Organization"), srv = nodos.find(n => n["@type"] === "Service");
  assert.equal(org["@id"], IDS.organizacion);
  assert.equal(srv["@id"], IDS.servicio);
  assert.equal(srv.serviceType, "Comparador de precios de hardware");
  assert.deepEqual([srv.areaServed["@type"], srv.areaServed.identifier], ["Country", "AR"]);
  assert.deepEqual(srv.provider, { "@id": IDS.organizacion });
  assert.ok(!/\w@\w|mailto/i.test(JSON.stringify(org)), "sin correo ni nombre de persona");
}

test("portada: Organization + Service + WebSite con SearchAction, coherentes con el generador", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
  const nodos = grafoDe(html);
  revisar(nodos);
  servicioYOrganizacion(nodos);
  assert.deepEqual(nodos.slice(0, 2), G.nodosDelSitio(BASE), "la portada y nodosDelSitio no se pueden separar");
  const sitio = nodos.find(n => n["@type"] === "WebSite");
  assert.equal(sitio["@id"], IDS.sitio);
  assert.equal(sitio.potentialAction["@type"], "SearchAction");
  assert.deepEqual(sitio.publisher, { "@id": IDS.organizacion });
});

test("/acerca/: los mismos Organization y Service, y la pagina colgada del sitio", () => {
  const nodos = grafoDe(Info.renderAcerca({ baseUrl: BASE }));
  revisar(nodos, { definidos: [IDS.sitio] });          // el WebSite se define en la portada
  servicioYOrganizacion(nodos);
  const acerca = nodos.find(n => n["@type"] === "AboutPage");
  assert.equal(acerca.url, `${BASE}/acerca/`);
  assert.deepEqual(acerca.isPartOf, { "@id": IDS.sitio });
});

/* Una /precios/<slug>/ armada como en generador.test.js (5 comparables en 2 comercios: indexable). */
const fila = (nombre, precio, tienda) => [nombre, precio, "https://t.test/" + encodeURIComponent(nombre), tienda, "", 0, 0, "", ""];
const IDX = { generado: "2026-10-09T08:12-03:00",
  tiendas: { cg: { nombre: "CompraGamer", color: "cg", relevado: "2026-10-09T08:12-03:00" }, mx: { nombre: "Mexx", color: "mx", relevado: "2026-10-09T08:12-03:00" } },
  productos: [1, 2, 3, 4, 5, 6].map(n => fila("Memoria Kingston " + n + " DDR4 16GB 3200MHz", 1000 + n, n % 2 ? "cg" : "mx")) };
function paginaPrecios() {
  const ctx = G.crearContexto(IDX, { baseUrl: BASE, ahora: new Date("2026-10-09T12:00:00-03:00"), marcas: { primera: ["kingston"], conocida: [] } });
  return { ctx, analisis: A.analizarConsulta("ddr4 16gb", ctx) };
}

test("/precios/<slug>/: CollectionPage + ItemList + migas, sin Product, con referencias a la organizacion", () => {
  const { ctx, analisis } = paginaPrecios();
  const html = G.renderPagina({ q: "ddr4 16gb", slug: "ddr4-16gb" }, analisis, ctx);
  const nodos = grafoDe(html);
  revisar(nodos, { definidos: [IDS.sitio, IDS.servicio] });
  const pagina = nodos.find(n => n["@type"] === "CollectionPage");
  assert.deepEqual(pagina.isPartOf, { "@id": IDS.sitio });
  assert.deepEqual(pagina.about, { "@id": IDS.servicio });
  assert.ok(!nodos.some(n => ["Organization", "Service"].includes(n["@type"])), "no se repite la identidad en cada pagina");
  const lista = nodos.find(n => n["@type"] === "ItemList");
  lista.itemListElement.forEach((e, i) => { assert.equal(e.position, i + 1); assert.ok(e.name && /^https?:/.test(e.url)); });
});
