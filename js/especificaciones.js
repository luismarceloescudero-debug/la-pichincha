/* Especificaciones clave de un aviso y si otro aviso las comparte (spec 017, fase 1).
   Al comparar desde una tarjeta (un monitor 27" OLED de 300 Hz, una PC de 32 GB y 1 TB) la comparativa tiene que
   hacerse contra avisos con las MISMAS especificaciones, no contra toda la familia o categoria. Todo sale del titulo:
   lo que el titulo no dice no se afirma (principio II). Funciones puras: no tocan el DOM ni la red. */
(function (raiz) {
  "use strict";

  const C = typeof module === "object" && module.exports ? require("./categorias.js") : raiz.Categorias;

  /* Lo que tiene que coincidir, por categoria. Las demas (perifericos, otros) no tienen especificaciones clave:
     se comparan como siempre. */
  const CLAVES = {
    monitor: ["pulgadas", "panel", "hz", "resolucion"],
    notebook: ["cpu", "ram", "rom", "gpu"],
    pc: ["cpu", "ram", "rom", "gpu"],
    smartphone: ["ram", "rom"],
    componente: ["capacidad", "ddr", "interfaz"],
    placa: ["gpu", "vram"],      // una placa de video es un componente, pero se compara por chip y memoria
  };
  const MIN_CLAVES = 2;      // con menos de dos especificaciones leidas la tarjeta no alcanza para comparar con justicia
  const MIN_COMPARABLES = 3; // menos que esto: la comparativa lo dice en vez de mezclar familias

  const resolucionDe = n => /\b(?:3440\s?x\s?1440|uwqhd)\b/i.test(n) ? "uwqhd"
    : /\b(?:4k|uhd|2160p?|3840\s?x\s?2160)\b/i.test(n) ? "4k"
    : /\b(?:qhd|wqhd|2k|2\.5k|1440p?|2560\s?x\s?1440)\b/i.test(n) ? "2k"
    : /\b(?:fhd|full\s?hd|1080p?|1920\s?x\s?1080)\b/i.test(n) ? "fhd" : "";

  /* Familia y generacion, no el modelo exacto: "i5-12400F" e "i5-12400" son lo mismo para comparar precio ("i5-12"). */
  function cpuDe(nombre) {
    const n = String(nombre).toLowerCase();
    let m;
    if ((m = n.match(/\bcore\s?ultra\s?([3579])\s?(\d)\d{2}/))) return `u${m[1]}-${m[2]}`;
    if ((m = n.match(/\b(?:core\s?)?i([3579])[-\s_]?(\d{4,5})[a-z]{0,2}\b/))) return `i${m[1]}-${m[2].length === 5 || m[2][0] === "1" ? m[2].slice(0, 2) : m[2][0]}`;
    if ((m = n.match(/\b(?:ryzen\s?(?:ai\s?)?|r)([3579])[-\s]?(\d)\d{3}[a-z]{0,2}\b/))) return `r${m[1]}-${m[2]}`;
    return "";
  }

  function gpuDe(nombre) {
    const m = String(nombre).toLowerCase().match(/\b(rtx|gtx|rx|arc)\s?([a-z]?\d{3,4})\s?(ti\s?super|ti|super|xtx|xt|gre)?\b/);
    return m ? [m[1], m[2], (m[3] || "").replace(/\s+/g, " ")].filter(Boolean).join(" ") : "";
  }

  /* Los Hz del titulo. Con mas de una frecuencia (monitores de modo dual: «4K 160Hz, Dual Mode FHD 320Hz») se devuelven todas, "160/320":
     mostrar solo la mayor diria «320 Hz · 4K», que no es lo que ese monitor hace. Con una sola, el numero de siempre. */
  function hzDe(nombre) {
    const todos = [...new Set([...String(nombre).matchAll(/\b(\d{2,3})\s?hz(?![a-z])/gi)].map(x => +x[1]))].sort((a, b) => a - b);
    return todos.length > 1 ? todos.join("/") : todos.length ? todos[0] : 0;
  }

  /* La capacidad que dice el titulo, la primera: «64GB (2x32GB)» es 64, «1TB» es 1000. No usa C.memoriaDe, que separa RAM de
     almacenamiento para notebooks y celulares (una sola capacidad de 32 GB no es ninguna de las dos) y deja afuera la
     memoria de una placa de video. */
  function capacidadDe(nombre) {
    const m = String(nombre).match(/(?<![\d.x])(\d{1,4})\s?(gb|tb)(?![a-z\d])/i);
    return m ? +m[1] * (/t/i.test(m[2]) ? 1000 : 1) : 0;
  }

  const ddrDe = n => { const m = String(n).match(/\bddr\s?([345])\b/i); return m ? `ddr${m[1]}` : ""; };
  const interfazDe = n => /\bnvme\b|\bm\.?2\b/i.test(n) ? "nvme" : /\bsata\b/i.test(n) ? "sata" : "";

  /* { categoria, valores: { clave: valor } } solo con lo que el titulo dice. */
  function clavesDe(nombre) {
    const categoria = C.categoriaDe(nombre);
    const nombres = CLAVES[categoria === "componente" && gpuDe(nombre) ? "placa" : categoria] || [];
    const mem = C.memoriaDe(nombre);
    const lectores = {
      pulgadas: () => C.pulgadasDe(nombre), panel: () => C.panelDe(nombre), hz: () => hzDe(nombre),
      resolucion: () => resolucionDe(nombre), cpu: () => cpuDe(nombre), gpu: () => gpuDe(nombre),
      ram: () => mem.ram, rom: () => mem.rom, capacidad: () => capacidadDe(nombre), vram: () => capacidadDe(nombre),
      ddr: () => ddrDe(nombre), interfaz: () => interfazDe(nombre),
    };
    const valores = {};
    for (const k of nombres) { const v = lectores[k](); if (v) valores[k] = v; }
    return { categoria, valores };
  }

  /* Si otro aviso comparte las especificaciones de la tarjeta de referencia. `aplica` es falso cuando la tarjeta no dice
     suficientes especificaciones: ahi no se filtra (se compara como siempre) y se avisa. Una especificacion que la
     tarjeta dice y el otro aviso no menciona NO cuenta como coincidencia. */
  function mismas(ref, f) {
    const a = clavesDe(ref[0]);
    const claves = Object.keys(a.valores);
    if (claves.length < MIN_CLAVES) return { aplica: false, coincide: true, ok: [], faltan: [], distintas: [] };
    const b = clavesDe(f[0]);
    const r = { aplica: true, ok: [], faltan: [], distintas: [] };
    if (b.categoria !== a.categoria) { r.distintas = claves; r.coincide = false; return r; }
    for (const k of claves) {
      if (b.valores[k] === undefined) r.faltan.push(k);
      else if (b.valores[k] !== a.valores[k]) r.distintas.push(k);
      else r.ok.push(k);
    }
    r.coincide = !r.faltan.length && !r.distintas.length;
    return r;
  }

  const gb = n => (n >= 1000 && n % 1000 === 0 ? `${n / 1000} TB` : `${n} GB`);
  const RESOLUCION = { "4k": "4K", "2k": "2K (QHD)", fhd: "Full HD", uwqhd: "UWQHD" };
  const textoCpu = c => { const [fam, gen] = c.split("-");
    return fam[0] === "u" ? `Core Ultra ${fam[1]} serie ${gen}` : fam[0] === "i" ? `Core i${fam[1]} ${gen}ª gen` : `Ryzen ${fam[1]} serie ${gen}000`; };
  const TEXTO = {
    pulgadas: v => `${v}"`, panel: v => v.toUpperCase(), hz: v => `${String(v).replace("/", " / ")} Hz`, resolucion: v => RESOLUCION[v] || v,
    cpu: textoCpu, ram: v => `${v} GB de RAM`, rom: gb, gpu: v => v.toUpperCase(), capacidad: gb,
    vram: v => `${v} GB`, ddr: v => v.toUpperCase(), interfaz: v => (v === "nvme" ? "NVMe" : "SATA"),
  };

  /* Las especificaciones de la tarjeta, en palabras: «27" · OLED · 300 Hz · 2K (QHD)». */
  function resumen(ref) {
    const { valores } = clavesDe(ref[0]);
    return Object.entries(valores).map(([k, v]) => TEXTO[k](v)).join(" · ");
  }

  const api = { CLAVES, MIN_CLAVES, MIN_COMPARABLES, clavesDe, mismas, resumen };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Especificaciones = api;
})(this);
