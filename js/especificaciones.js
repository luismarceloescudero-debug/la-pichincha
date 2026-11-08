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

  /* Pantalla en pulgadas con la unidad escrita («6.9 Pulgadas», 15.6"): un numero suelto («IdeaPad 15») es modelo, no pantalla.
     El monitor sigue usando C.pulgadasDe, que lee el numero solo porque ahi el titulo lo trae asi. */
  function pantallaDe(nombre) {
    const m = String(nombre).replace(/(\d),(\d)/g, "$1.$2").match(/(?<![\d.])(\d{1,2}(?:\.\d)?)\s?(?:"|”|″|''|′′|pulgadas|pulg\b|inch\b)/i);
    const v = m ? parseFloat(m[1]) : 0;
    return v >= 4 && v <= 100 ? v : 0;
  }
  const redDe = n => /(?<![\d.])5\s?g(?![a-z\d])/i.test(n) ? "5g" : /(?<![\d.])4\s?g(?![a-z\d])|\blte\b/i.test(n) ? "4g" : "";
  const velocidadDe = n => { const m = String(n).match(/\b(\d{3,5})\s?mhz\b/i); return m ? +m[1] : 0; };

  const categoriaClaves = (nombre, categoria) => (categoria === "componente" && gpuDe(nombre) ? "placa" : categoria);

  function lectoresDe(nombre) {
    const mem = C.memoriaDe(nombre);
    return {
      pulgadas: () => C.pulgadasDe(nombre), panel: () => C.panelDe(nombre), hz: () => hzDe(nombre),
      resolucion: () => resolucionDe(nombre), cpu: () => cpuDe(nombre), gpu: () => gpuDe(nombre),
      ram: () => mem.ram, rom: () => mem.rom, capacidad: () => capacidadDe(nombre), vram: () => capacidadDe(nombre),
      ddr: () => ddrDe(nombre), interfaz: () => interfazDe(nombre),
      pantalla: () => pantallaDe(nombre), red: () => redDe(nombre), velocidad: () => velocidadDe(nombre),
    };
  }

  /* { categoria, valores: { clave: valor } } solo con lo que el titulo dice. Es lo que decide si dos avisos son comparables. */
  function clavesDe(nombre) {
    const categoria = C.categoriaDe(nombre);
    const nombres = CLAVES[categoriaClaves(nombre, categoria)] || [];
    const lectores = lectoresDe(nombre);
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


  /* --- Lo que se MUESTRA de un aviso (tarjetas y tabla de la Comparativa) -------------------------------------------
     CLAVES decide si dos avisos son comparables; FICHA decide que se muestra de cada categoria, siempre las mismas y en el
     mismo orden: antes cada tarjeta mostraba lo que su titulo daba la casualidad de decir (un Ryzen 7 en una y nada en otra).
     Lo que el titulo no dice se muestra como «no informa», nunca se inventa (principio II). */
  const FICHA = {
    monitor: ["pulgadas", "panel", "hz", "resolucion"],
    notebook: ["cpu", "ram", "rom", "gpu", "pantalla"],
    pc: ["cpu", "ram", "rom", "gpu"],
    smartphone: ["ram", "rom", "red", "pantalla"],
    componente: ["capacidad", "ddr", "interfaz", "velocidad"],
    placa: ["gpu", "vram"],
  };
  const ETIQUETA = { pulgadas: "Pantalla", pantalla: "Pantalla", panel: "Panel", hz: "Frecuencia", resolucion: "Resolución", cpu: "Procesador",
    ram: "RAM", rom: "Almacenamiento", gpu: "Gráficos", capacidad: "Capacidad", ddr: "Tipo de memoria", interfaz: "Interfaz",
    vram: "Memoria de video", red: "Red", velocidad: "Velocidad" };
  TEXTO.pantalla = v => `${v}"`;
  TEXTO.red = v => v.toUpperCase();
  TEXTO.velocidad = v => `${v} MHz`;
  const TEXTO_FICHA = { ...TEXTO, ram: v => `${v} GB` };   // la etiqueta ya dice «RAM»

  /* { categoria, filas: [{ clave, etiqueta, valor, texto }] }: una fila por cada especificacion de la categoria; `texto` es "" si el titulo no la dice. */
  function fichaDe(nombre) {
    const categoria = C.categoriaDe(nombre);
    const nombres = FICHA[categoriaClaves(nombre, categoria)] || [];
    const lectores = lectoresDe(nombre);
    const filas = nombres.map(clave => {
      const valor = lectores[clave]();
      return { clave, etiqueta: ETIQUETA[clave] || clave, valor: valor || null, texto: valor ? TEXTO_FICHA[clave](valor) : "" };
    });
    return { categoria, filas };
  }

  const api = { CLAVES, FICHA, ETIQUETA, fichaDe, MIN_CLAVES, MIN_COMPARABLES, clavesDe, mismas, resumen };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Especificaciones = api;
})(this);
