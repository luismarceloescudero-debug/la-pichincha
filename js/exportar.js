/* --- Exportar y compartir ---------------------------------------------
   En la web funciona todo. Dentro de un visor embebido el navegador bloquea
   la impresion y las descargas, asi que ahi solo se ofrece lo que si anda. */
const SUELTA = (() => { try { return window.self === window.top; } catch (e) { return false; } })();

function avisar(boton, texto) {
  const previo = boton.innerHTML;
  boton.innerHTML = `${icono("check")} ${texto}`;
  boton.dataset.ok = "1";
  setTimeout(() => { boton.innerHTML = previo; delete boton.dataset.ok; }, 1800);
}

async function copiar(texto, boton) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar(boton, "copiado");
  } catch (e) {                      // sin permiso de portapapeles: lo dejo seleccionable
    const ta = document.createElement("textarea");
    ta.value = texto; ta.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); avisar(boton, "copiado"); }
    catch (_) { avisar(boton, "copiá a mano"); }
    ta.remove();
  }
}

/* En la web se baja con un enlace. Dentro del visor de Claude eso esta
   bloqueado, pero la pagina puede pedir la descarga por la capacidad
   downloads, que le muestra al visitante una confirmacion. */
let DESCARGAS = null;
(async () => {
  try { DESCARGAS = (await window.claude?.use?.("downloads")) || null; } catch (e) { DESCARGAS = null; }
  document.querySelectorAll('[data-acc="excel"]').forEach(b => { b.hidden = !(SUELTA || DESCARGAS); });
})();

async function bajarArchivo(nombre, contenido, tipo, boton) {
  if (DESCARGAS) {
    try {
      await DESCARGAS.save({ filename: nombre, data: new Blob([contenido], { type: tipo }) });
      return avisar(boton, "descargado");
    } catch (e) {
      if (e && e.code === "declined") return;
      if (e && e.code === "rate_limited") return avisar(boton, "probá de nuevo");
      if (!SUELTA) return avisar(boton, "no disponible acá");
    }
  }
  if (!SUELTA) return avisar(boton, "no disponible acá");
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const csvCampo = v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;

function aCSV(filas) {
  // Punto y coma y BOM: asi Excel en español lo abre en columnas sin preguntar nada.
  const cab = ["Producto", "Precio", "Fuente", "Comercio", "Enlace"];
  const cuerpo = filas.map(f => {
    const t = (IDX && IDX.tiendas[f[3]]) || { nombre: f[3] };
    return [f[0], f[1], t.nombre + (viejoDe(f) ? ` (${viejoDe(f)})` : ""), f[4] || "", f[2]].map(csvCampo).join(";");
  });
  return "\uFEFF" + [cab.map(csvCampo).join(";"), ...cuerpo].join("\r\n");
}

function aTexto(filas, titulo) {
  const lineas = filas.slice(0, 20).map((f, i) => {
    const t = (IDX && IDX.tiendas[f[3]]) || { nombre: f[3] };
    return `${i + 1}. ${f[0]} — ${pesos(f[1])} · ${t.nombre}${f[4] ? " (" + f[4] + ")" : ""}${viejoDe(f) ? " · " + viejoDe(f) : ""}\n   ${f[2]}`;
  });
  return `${titulo}\n${"—".repeat(Math.min(titulo.length, 40))}\n\n${lineas.join("\n")}` +
    (filas.length > 20 ? `\n\n…y ${filas.length - 20} más` : "") +
    `\n\nLa Pichincha · ${enlaceActual()}`;
}

async function compartir(titulo, texto, boton) {
  if (navigator.share) {
    try { await navigator.share({ title: titulo, text: texto }); return; }
    catch (e) { if (e.name === "AbortError") return; }
  }
  copiar(texto, boton);
}

function barraAcciones(id) {
  const b = [`<button class="acc" data-acc="compartir" data-de="${id}">${icono("compartir")} Compartir</button>`,
             `<button class="acc" data-acc="copiar" data-de="${id}">${icono("copiar")} Copiar</button>`];
  b.push(`<button class="acc" data-acc="excel" data-de="${id}"${SUELTA || DESCARGAS ? "" : " hidden"}>${icono("tabla")} Excel</button>`);
  if (SUELTA) b.push(`<button class="acc" data-acc="imprimir" data-de="${id}">${icono("imprimir")} Imprimir o PDF</button>`);
  return `<div class="acciones">${b.join("")}</div>`;
}

/* Que se exporta segun la vista en la que estes. */
function materia(de) {
  if (CONSULTA && ANALISIS && DINAMICAS.includes(de))
    return { filas: ANALISIS.picks.map(p => p.m.f), titulo: `«${CONSULTA}»: mejor compra y alternativas`,
             archivo: "comparativa-" + normal(CONSULTA).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") };
  if (de === "buscar") {
    const q = ($("#q") || {}).value || "";
    // cada aviso va en la descarga, tambien los de las otras tiendas del mismo modelo
    return { filas: ULTIMA_BUSQUEDA.flatMap(f => [f, ...(OTRAS.get(f) || [])]), titulo: q ? `Búsqueda: ${q}` : "La Pichincha", archivo: "busqueda" };
  }
  const p = porId[de];
  if (p) {
    const t = T[p.tienda];
    return {
      filas: [[p.nombre, p.precio, p.url, p.tienda]],
      titulo: `${p.nombre} — ${pesos(p.precio)} en ${t.nombre}`,
      archivo: p.id,
    };
  }
  if (de === "ofertas") return { filas: ofertasFiltradas().map(o => o.f), titulo: "Ofertas imperdibles", archivo: "ofertas" };
  const c = CATEGORIAS.find(x => x.id === CAT) || CATEGORIAS[0];
  return {
    filas: c.lista.map(x => [x.nombre, x.precio, x.url, x.tienda]),
    titulo: c.titulo,
    archivo: c.id,
  };
}

document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-acc]");
  if (!b) return;
  const m = materia(b.dataset.de);
  if (!m.filas.length) return avisar(b, "nada para exportar");
  const hoy = new Date().toISOString().slice(0, 10);
  const base = `la-pichincha-${m.archivo}-${hoy}`;

  if (b.dataset.acc === "excel") {
    const previo = b.innerHTML;
    b.innerHTML = `${icono("tabla")} armando…`;
    try {
      await cargarExcel();
      b.innerHTML = previo;
      await bajarArchivo(`${base}.xlsx`, await aXLSX(m.filas, m.titulo),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", b);
      medir(Pagina.eventoAccion("excel", b.dataset.de));
    } catch (e) {                      // sin CDN no hay libro, pero el CSV sirve igual
      b.innerHTML = previo;
      await bajarArchivo(`${base}.csv`, aCSV(m.filas), "text/csv;charset=utf-8", b);
      medir(Pagina.eventoAccion("csv", b.dataset.de));
    }
  }
  else if (b.dataset.acc === "imprimir") { medir(Pagina.eventoAccion("imprimir", b.dataset.de)); window.print(); }
  else if (b.dataset.acc === "copiar") { medir(Pagina.eventoAccion("copiar", b.dataset.de)); copiar(aTexto(m.filas, m.titulo), b); }
  else { medir(Pagina.eventoAccion("compartir", b.dataset.de)); compartir(m.titulo, aTexto(m.filas, m.titulo), b); }
});

/* --- Libro de Excel nativo -------------------------------------------
   ExcelJS pesa 257 KB comprimido, asi que se baja recien cuando pedis el
   archivo, no en cada visita. Si el CDN no responde, cae en CSV. */
const EXCEL_URL = "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js";
let excelPromesa = null;

function cargarExcel() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!excelPromesa) {
    excelPromesa = new Promise((listo, falla) => {
      const et = document.createElement("script");
      et.src = EXCEL_URL;
      et.onload = () => (window.ExcelJS ? listo(window.ExcelJS) : falla(new Error("sin ExcelJS")));
      et.onerror = () => { excelPromesa = null; falla(new Error("no cargo")); };
      document.head.appendChild(et);
    });
  }
  return excelPromesa;
}

const TINTA = "FF14181F", BORDE = "FFD9DFE8", CEBRA = "FFF4F6F9",
      GANA = "FFDFF3E8", GANA_TINTA = "FF117A4A", ENLACE = "FF0B4FD8";

async function aXLSX(filas, titulo) {
  const libro = new window.ExcelJS.Workbook();
  libro.creator = "La Pichincha";
  libro.created = new Date();

  const hoja = libro.addWorksheet("Ofertas", {
    views: [{ state: "frozen", ySplit: 1 }],          // la cabecera queda fija al scrollear
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  hoja.columns = [
    { header: "Producto", key: "p", width: 62 },
    { header: "Precio", key: "v", width: 14, style: { numFmt: '"$"#,##0' } },
    { header: "Fuente", key: "f", width: 16 },
    { header: "Comercio", key: "c", width: 20 },
    { header: "Enlace", key: "u", width: 56 },
  ];

  const cab = hoja.getRow(1);
  cab.height = 24;
  cab.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  cab.alignment = { vertical: "middle" };
  cab.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TINTA } }; });

  filas.forEach((f, i) => {
    const t = (IDX && IDX.tiendas[f[3]]) || T[f[3]] || { nombre: f[3] };
    const fila = hoja.addRow({ p: f[0], v: f[1], f: t.nombre + (viejoDe(f) ? ` (${viejoDe(f)})` : ""), c: f[4] || "", u: null });
    fila.getCell("u").value = { text: f[2], hyperlink: f[2] };
    fila.getCell("u").font = { color: { argb: ENLACE }, underline: true };
    fila.getCell("p").alignment = { wrapText: true, vertical: "top" };
    fila.getCell("v").alignment = { horizontal: "right" };
    fila.eachCell(c => { c.border = { bottom: { style: "thin", color: { argb: BORDE } } }; });
    if (i === 0) {                                    // el mas barato, resaltado
      fila.font = { bold: true, color: { argb: GANA_TINTA } };
      fila.getCell("u").font = { color: { argb: ENLACE }, underline: true, bold: true };
      fila.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GANA } }; });
    } else if (i % 2 === 1) {
      fila.eachCell(c => { c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CEBRA } }; });
    }
  });
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: filas.length + 1, column: 5 } };

  const info = libro.addWorksheet("Info");
  info.columns = [{ width: 16 }, { width: 64 }];
  const titulo1 = info.addRow(["La Pichincha"]);
  titulo1.font = { bold: true, size: 16, color: { argb: TINTA } };
  const sub = info.addRow(["Hardware en Argentina. No lo más barato: lo que más rinde."]);
  sub.font = { italic: true, color: { argb: "FF4E5767" } };
  info.addRow([]);
  [["Exportado", new Date().toLocaleString("es-AR")],
   ["Selección", titulo],
   ["Productos", filas.length],
   ["Precios de", DATOS.actualizado],
   ["Sitio", location.origin + location.pathname]].forEach(([k, v]) => {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true };
  });
  info.addRow([]);
  info.addRow(["", "Son los precios de transferencia o depósito de cada tienda, con IVA y sin envío."]);
  info.addRow(["", "Verificá en la web antes de pagar: el hardware se mueve rápido."]);

  return libro.xlsx.writeBuffer();
}
