/* Categorias de la pagina y sus criterios, con numeros concretos (spec 012).
   Cada categoria tiene sus propios minimos y su propia gama alta/media: un requisito de una categoria
   (la VRAM de una placa de video, los Hz de un monitor) no se le aplica a las otras.
   Todo sale del TITULO del aviso: el indice no trae fichas. Lo que el titulo no dice no se inventa:
   donde falta el dato clave se dice "sin dato" y el aviso no se destaca; en componentes y perifericos
   solo se descarta lo que muestra un dato por debajo del minimo.

   | Categoria  | Minimos                                      | Gama media                         | Gama alta (3 señales o mas, salvo monitor)               |
   | monitor    | 144 Hz, panel no TN, 24"                      | 144-239 Hz con IPS/VA/OLED/Mini-LED | 240 Hz o mas con OLED, QD-OLED o Mini-LED               |
   | smartphone | 6 GB RAM, 128 GB, 4.500 mAh, 90 Hz, chip no   | lo que pasa y no es alta           | RAM 8+, 256+ GB, chip tope, 108+ MP, 7+ años de        |
   |            | de entrada, 4+ años de actualizaciones, gen.  |                                    | actualizaciones, OLED 120 Hz, ultima generacion          |
   | notebook/pc| 16 GB RAM, 512 GB, generacion reciente, no HD | lo que pasa y no es alta           | RAM 32+, 1 TB, CPU i7/i9/Ultra 7-9/Ryzen 7-9/M Pro-Max,  |
   |            |                                              |                                    | RTX xx60 o mas, pantalla OLED/2.5K+/120 Hz, ultima gen.  |
   | componente | segun el tipo: placa de video 8 GB VRAM, RAM 16 GB DDR4+, SSD 480 GB, fuente 550 W | | placa 16 GB VRAM, DDR5 32 GB 6000 MHz, NVMe Gen4 1 TB, 750 W Gold |
   | periferico | ninguno                                      | -                                  | -                                                        |  */
(function (raiz) {
  "use strict";

  const B = typeof module === "object" && module.exports ? require("./buscador.js") : raiz.Buscador;

  const ORDEN = ["smartphone", "notebook", "monitor", "pc", "componente", "periferico", "otro"];
  const ETIQUETAS = { smartphone: "Smartphones", notebook: "Notebooks", monitor: "Monitores", pc: "PCs completas",
                      componente: "Componentes", periferico: "Periféricos", otro: "Otros" };

  const ETIQUETA = { smartphone: "Smartphone", notebook: "Notebook", monitor: "Monitor", pc: "PC completa",
                     componente: "Componente", periferico: "Periférico", otro: "Otro" };

  /* Descuento minimo para ser oferta: en equipos un 10% ya es buena; en componentes y perifericos se exige mas.
     `publicada` es el tachado de la tienda (puede estar inflado); `propia` es la baja medida contra el historial. */
  const DESCUENTO = {
    smartphone: { publicada: 0.10, propia: 0.05 }, notebook: { publicada: 0.10, propia: 0.05 }, pc: { publicada: 0.10, propia: 0.05 },
    monitor: { publicada: 0.12, propia: 0.05 }, componente: { publicada: 0.20, propia: 0.08 },
    periferico: { publicada: 0.20, propia: 0.08 }, otro: { publicada: 0.15, propia: 0.03 }
  };

  /* Cuantos lugares reserva cada categoria en un resumen: reservado, y tope antes de repartir lo que sobra. */
  const CUPO = { reservado: 2, tope: 3 };

  const MIN = {
    monitor: { hz: 144, pulgadas: 24, altaHz: 240 },
    smartphone: { ram: 8, ramMin: 6, rom: 128, romAlta: 256, bateria: 4500, hz: 90, actualizaciones: 4, actualizacionesAlta: 7, camaraAlta: 108 },
    notebook: { ram: 16, ramAlta: 32, rom: 512, romAlta: 1000 },
    pc: { ram: 16, ramAlta: 32, rom: 512, romAlta: 1000 },
    componente: { vram: 8, vramAlta: 16, memoria: 16, memoriaAlta: 32, mhzAlta: 6000, ssd: 480, ssdAlta: 1000, fuente: 550, fuenteAlta: 750 }
  };

  /* --- Que categoria es --------------------------------------------------- */
  const RE = {
    // lo que se vende PARA un equipo no es el equipo: "Funda iPhone 17" no tiene RAM
    accesorio: /^\s*(?:funda|fundas|case|carcasa|vidrio|protector|film|cargador|cable|adaptador|soporte|base|mochila|bolso|maletin|estuche|correa|pulsera|skin|lamina|bateria)\b/i,
    // "Funda para notebook" es un accesorio; "Memoria RAM de Notebook" o "SSD para notebook" son componentes (se miran antes)
    accesorioPara: /\b(?:para|de)\s+(?:notebook|laptop|macbook|celular|iphone|monitor)\b/i,
    monitor: /^\s*monitor\b|\bmonitor\b/i,
    // el monitor que viene dentro de un equipo o un lote no es un monitor
    equipoConMonitor: /^\s*(?:pc|computadora|computador|combo|kit|notebook|all\s?in\s?one|mini\s?pc|escritorio|puesto)\b/i,
    pc: /^\s*(?:pc|computadora|computador|all\s?in\s?one|mini\s?pc|equipo\s+armado)\b/i,
    periferico: /^\s*combo\b.*\b(?:teclado|mouse|auricular)|^\s*(?:mouse|teclado|auricular|auriculares|headset|webcam|camara\s+web|parlante|parlantes|joystick|gamepad|control|mousepad|pad|microfono|silla|alfombrilla|volante|capturadora|impresora|router|switch|placa\s+de\s+sonido)\b/i,
    notebook: /\b(notebook|netbook|laptop|macbook|chromebook|ultrabook|portatil|ideapad|thinkpad|thinkbook|vivobook|zenbook|victus|pavilion|probook|elitebook|inspiron|latitude|vostro|aspire|loq|legion\s?\d)(?![a-z])/i,
    smartphone: /\b(celular|smartphone|telefono|movil|iphone|redmi|poco\s?[a-z]\d|moto\s?(?:[gex]\d|edge|razr)|motorola\s+(?:edge|razr)|galaxy\s?(?:[samf]\d|z\s?(?:fold|flip))|honor\s?(?:\d|x\d|magic)|oppo\s?(?:reno|a\d|find)|vivo\s?[vyx]\d|oneplus|nothing\s+phone|zte\s?(?:blade|nubia)|realme|infinix|tecno\s(?:spark|camon|pova|phantom)|pixel\s?\d+)(?![a-z])/i,
    // por el principio del titulo (antes que notebook/smartphone: "Memoria RAM Notebook SODIMM" es una memoria)
    componenteInicio: /^\s*(?:memoria|ram|sodimm|ssd|disco|hdd|placa|vga|procesador|micro|fuente|gabinete|cooler|fan|disipador|refrigeracion|ventilador|pasta|gpu|tarjeta|kit\s+de\s+memoria|pendrive|cpu|combo\s+(?:amd|intel|ryzen))\b/i,
    componente: /\b(?:ddr[345]|nvme|geforce|radeon|rtx|gtx|lga\s?\d{3,4})\b/i
  };

  function categoriaDe(nombre) {
    const n = String(nombre);
    if (RE.accesorio.test(n)) return "periferico";
    if (RE.componenteInicio.test(n)) return "componente";
    if (RE.accesorioPara.test(n)) return "periferico";
    if (RE.monitor.test(n) && !RE.equipoConMonitor.test(n)) return "monitor";
    if (RE.pc.test(n)) return "pc";
    if (RE.periferico.test(n)) return "periferico";
    if (RE.notebook.test(n)) return "notebook";
    if (RE.smartphone.test(n)) return "smartphone";
    if (RE.componente.test(n)) return "componente";
    return "otro";
  }

  /* --- Que dice el titulo ------------------------------------------------- */
  const aGB = (n, u) => Math.round(parseFloat(n) * (/t/i.test(u) ? 1000 : 1));

  function memoriaDe(nombre) {
    const n = String(nombre).replace(/(\d),(\d)/g, "$1.$2");
    let m;
    const caps = [...n.matchAll(/\b(\d{1,4})\s?(gb|tb)\b/gi)].map(x => aGB(x[1], x[2])).sort((a, b) => a - b);
    if ((m = n.match(/(\d{1,3})\s?gb\s*(?:de\s*)?(?:memoria\s+)?ram\b/i) || n.match(/\bram\s*[:\-]?\s*(?:de\s*)?(\d{1,3})\s?gb/i))) {
      const otras = caps.filter(c => c !== +m[1]);       // lo que no es la RAM es el almacenamiento
      return { ram: +m[1], rom: otras.length ? otras[otras.length - 1] : 0 };
    }
    if ((m = n.match(/\b(\d{1,2})\s?(?:gb)?\s*[+\/|]\s*(\d{2,4})\s?(gb|tb)\b/i)) && +m[1] <= 64)
      return { ram: +m[1], rom: aGB(m[2], m[3]) };
    if (caps.length >= 2 && caps[0] <= 64) return { ram: caps[0], rom: caps[caps.length - 1] };
    return { ram: 0, rom: caps.length === 1 && caps[0] >= 64 ? caps[0] : 0 };   // una sola capacidad grande: es el almacenamiento
  }

  const hzDe = n => { const m = [...String(n).matchAll(/\b(\d{2,3})\s?hz(?![a-z])/gi)].map(x => +x[1]); return m.length ? Math.max(...m) : 0; };
  const panelDe = n => /qd-?\s?oled/i.test(n) ? "qd-oled" : /mini-?\s?led/i.test(n) ? "mini-led" : /\boled\b|amoled/i.test(n) ? "oled"
    : /\bips\b/i.test(n) ? "ips" : /\bva\b/i.test(n) ? "va" : /\btn\b/i.test(n) ? "tn" : "";
  /* 27", 27'', 27″, 27”, 27 pulgadas, 23,8″ y 23.8: cada tienda escribe las pulgadas a su manera. */
  const pulgadasDe = n => { const m = String(n).match(/(?:^|\s)(\d{2}(?:[.,]\d)?)(?=\s|"|''|”|″|′′|$|pulgadas|pulg)/i); return m ? parseFloat(m[1].replace(",", ".")) : 0; };

  /* Generaciones (familia -> numero) para saber que es "reciente": se comparan con lo mas nuevo del indice. `paso` es
     cuanto avanza la numeracion por generacion (Ryzen salta de a dos: 5000, 7000, 9000). */
  const GENERACIONES = [
    ["iphone", "iPhone", 1, /\biphone\s?(\d{1,2})\b/i, m => +m[1]],
    ["apple-m", "chip M", 1, /\b(?:macbook|imac|mac\s?mini|ipad)\b.*?\bm([1-9])\b/i, m => +m[1]],
    ["galaxy-s", "Galaxy S", 1, /\bgalaxy\s?s(\d{1,2})\b/i, m => +m[1]],
    ["pixel", "Pixel", 1, /\bpixel\s?(\d{1,2})\b/i, m => +m[1]],
    ["snapdragon", "Snapdragon 8", 1, /\bsnapdragon\s?8\s?(?:gen\s?(\d)|elite(?:\s?gen\s?(\d))?)/i, m => m[1] ? +m[1] : m[2] ? +m[2] + 1 : 5],
    ["intel-core", "Core i", 1, /\bcore\s?i[3579][-\s](\d{4,5})/i, m => m[1].length === 5 ? +m[1].slice(0, 2) : +m[1][0]],
    ["core-ultra", "Core Ultra", 1, /\bcore\s?ultra\s?[3579]\s?(\d)\d{2}/i, m => +m[1]],
    ["ryzen", "Ryzen", 2, /\bryzen\s?[3579]\s?(\d)\d{3}/i, m => +m[1]]
  ];
  const generacionesDe = nombre => GENERACIONES.flatMap(([fam, et, paso, re, gen]) => {
    const m = String(nombre).match(re);
    return m ? [{ fam, et, paso, gen: gen(m) }] : [];
  });
  const aniosDe = nombre => [...String(nombre).matchAll(/\b(20[12]\d)\b/g)].map(m => +m[1]);

  const MIN_SALTO = 2, MIN_COMPARADOS = 2;   // apartados que tiene que mejorar la ultima generacion, de los que se pueden comparar

  /* Apartados que el titulo puede decir. Se comparan generacion contra generacion de la misma familia. */
  function aspectosDe(nombre) {
    const { ram, rom } = memoriaDe(nombre), a = {};
    let m;
    if (ram) a.ram = ram;
    if (rom) a.rom = rom;
    if (hzDe(nombre)) a.hz = hzDe(nombre);
    if ((m = nombre.match(/\b(\d{4,5})\s?mah(?![a-z])/i))) a.bateria = +m[1];
    if ((m = nombre.match(/\b(\d{2,3})\s?mp(?![a-z])/i))) a.camara = +m[1];
    if (/\bamoled|\boled\b/i.test(nombre)) a.oled = 1;
    return a;
  }

  /* Lo mas nuevo que hay a la venta, por familia y en años, mirando los titulos del indice, y cuanto mejoro
     la ultima generacion de cada familia contra la anterior: { gen, anio, salto: { familia: { mejoras, comparados } } }. */
  function referencia(productos) {
    const gen = {}, porGen = {}; let anio = 0;
    for (const f of productos) {
      const asp = aspectosDe(f[0]);
      for (const g of generacionesDe(f[0])) {
        gen[g.fam] = Math.max(gen[g.fam] || 0, g.gen);
        const caja = ((porGen[g.fam] = porGen[g.fam] || {})[g.gen] = (porGen[g.fam][g.gen] || {}));
        for (const k of Object.keys(asp)) (caja[k] = caja[k] || []).push(asp[k]);
      }
      for (const a of aniosDe(f[0])) anio = Math.max(anio, a);
    }
    const salto = {};
    for (const fam of Object.keys(gen)) {
      const paso = (GENERACIONES.find(g => g[0] === fam) || [0, 0, 1])[2];
      const ult = (porGen[fam] || {})[gen[fam]], ant = (porGen[fam] || {})[gen[fam] - paso];
      if (!ult || !ant) continue;
      const comunes = Object.keys(ult).filter(k => ant[k]);
      salto[fam] = { comparados: comunes.length, mejoras: comunes.filter(k => B.mediana(ult[k]) > B.mediana(ant[k])).length };
    }
    return { gen, anio, salto };
  }

  /* --- Evaluar ------------------------------------------------------------ */
  const no = (categoria, motivo, extra) => ({ categoria, rubro: categoria, pasa: false, motivo, nivel: null, alta: false, vigente: false, rom: 0, nota: "", ...extra });
  const ok = (categoria, nivel, extra) => ({ categoria, rubro: categoria, pasa: true, nivel, alta: nivel === "alta", vigente: false, rom: 0, nota: "", ...extra });

  function monitor(nombre) {
    const m = MIN.monitor, hz = hzDe(nombre), panel = panelDe(nombre), pulg = pulgadasDe(nombre);
    if (!hz) return no("monitor", "sin dato de tasa de refresco");
    if (hz < m.hz) return no("monitor", `solo ${hz} Hz (mínimo ${m.hz})`);
    if (panel === "tn") return no("monitor", "panel TN");
    if (pulg && pulg < m.pulgadas) return no("monitor", `${pulg}" (mínimo ${m.pulgadas}")`);
    const premium = ["oled", "qd-oled", "mini-led"].includes(panel);
    if (premium && hz >= m.altaHz) return ok("monitor", "alta");
    if (premium || panel === "ips" || panel === "va")
      return ok("monitor", "media", { nota: hz >= m.altaHz ? "no llega a gama alta: falta un panel OLED, QD-OLED o Mini-LED" : premium ? `no llega a gama alta: ${hz} Hz (hacen falta ${m.altaHz} o más)` : "" });
    return ok("monitor", null);
  }

  /* El procesador y el año: el titulo puede decirlos aunque no diga la RAM (iPhone, MacBook). */
  function vigenciaDe(nombre, ref) {
    const v = { reciente: false, punto: false, vigente: false, nota: "", falla: "" };
    for (const g of generacionesDe(nombre)) {
      const tope = ref.gen[g.fam] || g.gen, s = (ref.salto || {})[g.fam];
      const hay = s && s.comparados >= MIN_COMPARADOS, minimo = hay && s.mejoras < MIN_SALTO;
      if (g.gen < tope - g.paso) { v.falla = v.falla || `${g.et} ${g.gen}: la generación vigente es la ${tope}`; continue; }
      v.reciente = true;
      // La novedad de la ultima generacion cuenta solo si mejoro varios apartados contra la anterior. Si no lo hizo
      // (diferencia minima), la anterior sigue vigente y las dos reciben el punto; si lo hizo, la anterior queda atras.
      if (g.gen >= tope) v.punto = true;
      else if (minimo && g.gen === tope - g.paso) v.punto = v.vigente = true;
      if (hay && g.gen >= tope - g.paso) {
        const cuanto = `${s.mejoras} de ${s.comparados} apartados`;
        v.nota = g.gen >= tope
          ? (minimo ? `${g.et} ${g.gen} mejoró solo ${cuanto} contra el ${g.gen - g.paso}: no suma como novedad y queda en la misma gama que el año anterior`
                    : `${g.et} ${g.gen} mejoró ${cuanto} contra el ${g.gen - g.paso}: es una novedad real`)
          : (minimo ? `el ${g.et} ${tope} mejoró solo ${cuanto} contra este modelo: sigue vigente como el año anterior`
                    : `el ${g.et} ${tope} mejoró ${cuanto} contra este modelo: ya no cuenta como gama alta`);
      }
    }
    const anios = aniosDe(nombre);
    if (anios.length) {
      const a = Math.max(...anios);
      if (ref.anio && a < ref.anio - 1) v.falla = v.falla || `modelo ${a}: lo vigente es de ${ref.anio}`;
      else v.reciente = true;
    }
    return v;
  }

  const cpuTier = n => { let m;
    if ((m = n.match(/\bcore\s?ultra\s?([3579])/i)) || (m = n.match(/\bcore\s?i([3579])/i)) || (m = n.match(/\bryzen\s?(?:ai\s?)?([3579])\b/i))) return +m[1];
    if ((m = n.match(/\bm[1-9]\s?(pro|max|ultra)\b/i))) return 9;
    return /\bm[1-9]\b/i.test(n) ? 5 : 0; };
  const gpuAlta = n => { const m = n.match(/\brtx\s?(\d{4})/i); return !!m && Math.floor(+m[1] / 1000) >= 4 && +m[1] % 1000 >= 60; };
  const pantallaPremium = n => /\bamoled|\boled\b|\b(?:2\.?5k|qhd|wqxga|2k|3k|4k)\b/i.test(n) || hzDe(n) >= 120;

  /* Celular, notebook y pc comparten la forma: minimos, vigencia y 3 señales para gama alta. */
  function equipo(categoria, nombre, ref) {
    const m = MIN[categoria], { ram, rom } = memoriaDe(nombre), v = vigenciaDe(nombre, ref);
    const piso = categoria === "smartphone" ? m.ramMin : m.ram;
    let x;
    if (ram && ram < piso) return no(categoria, `solo ${ram} GB de RAM (mínimo ${piso})`);
    if (ram && rom && rom < m.rom) return no(categoria, `solo ${rom} GB de almacenamiento (mínimo ${m.rom})`);   // una ROM que no se lee no descalifica
    if (v.falla) return no(categoria, v.falla);
    if (categoria === "smartphone") {
      if ((x = nombre.match(/\b(\d{4,5})\s?mah(?![a-z])/i)) && +x[1] < m.bateria) return no(categoria, `batería de ${x[1]} mAh (mínimo ${m.bateria})`);
      if (hzDe(nombre) && hzDe(nombre) < m.hz) return no(categoria, `pantalla de ${hzDe(nombre)} Hz (mínimo ${m.hz})`);
      if (/\bunisoc|\bhelio\b|snapdragon\s?(?:[246]\d{0,2}\b)|dimensity\s?6\d{3}|exynos\s?8\d{2}/i.test(nombre)) return no(categoria, "chip de entrada");
      if ((x = nombre.match(/\b(\d{1,2})\s*(?:años|anos|years?)\s*(?:de\s*)?(?:actualizaciones|updates?|soporte)/i)) && +x[1] < m.actualizaciones)
        return no(categoria, `solo ${x[1]} años de actualizaciones (mínimo ${m.actualizaciones})`);
    } else if (categoria === "notebook" && /\bhd\b(?!\+)/i.test(nombre) && !/\b(?:f|u|w)hd\b/i.test(nombre)) {
      return no(categoria, "pantalla HD de baja resolución");             // en una PC, "HD" es el disco o la grafica Intel HD
    }
    if (!ram && !v.reciente) return no(categoria, "sin datos de RAM, procesador ni año en el título");
    let puntos;
    if (categoria === "smartphone") {
      const act = nombre.match(/\b(\d{1,2})\s*(?:años|anos|years?)\s*(?:de\s*)?(?:actualizaciones|updates?|soporte)/i);
      const cam = nombre.match(/\b(\d{2,3})\s?mp(?![a-z])/i);
      puntos = [ram >= m.ram, rom >= m.romAlta, v.punto, /\b(pro|ultra|max|fold|flip)\b/i.test(nombre),
        /snapdragon\s?8\s?(?:gen|elite)|dimensity\s?9\d{3}|tensor\s?g[3-9]|exynos\s?2[4-9]\d{2}/i.test(nombre)
          || /\biphone\b/i.test(nombre) && /\ba(?:1[7-9]|[2-9]\d)\s?(?:pro|bionic)?\b/i.test(nombre),   // A17+ solo en un iPhone: Galaxy A55 no
        !!cam && +cam[1] >= m.camaraAlta, !!act && +act[1] >= m.actualizacionesAlta,
        /\bamoled|\boled\b/i.test(nombre) && hzDe(nombre) >= 120].filter(Boolean).length;
    } else {
      puntos = [ram >= m.ramAlta, rom >= m.romAlta, cpuTier(nombre) >= 7, gpuAlta(nombre), pantallaPremium(nombre), v.punto, /\bddr5\b/i.test(nombre)].filter(Boolean).length;
    }
    const alta = puntos >= 3;
    return ok(categoria, alta ? "alta" : "media", { rom, vigente: alta && v.vigente, nota: v.nota });
  }

  const capacidadMemoria = n => { const k = n.match(/\b(\d)\s?x\s?(\d{1,3})\s?gb\b/i); if (k) return +k[1] * +k[2];
    const m = n.match(/\b(\d{1,3})\s?gb\b/i); return m ? +m[1] : 0; };

  /* Cada tipo de componente tiene sus propios requisitos: la VRAM es solo de las placas de video. */
  function componente(nombre) {
    const m = MIN.componente, n = String(nombre);
    let x;
    if (/\b(?:rtx|gtx|rx\s?\d{4}|radeon|geforce)\b|placa de video|tarjeta grafica/i.test(n)) {
      const vram = (x = n.match(/\b(\d{1,2})\s?g(?:b)?\b/i)) ? +x[1] : 0;     // 16GB o 16G, como lo escribe cada tienda
      if (!vram) return ok("componente", null);
      if (vram < m.vram) return no("componente", `solo ${vram} GB de VRAM (mínimo ${m.vram})`);
      return ok("componente", vram >= m.vramAlta ? "alta" : "media");
    }
    if (/\bddr[345]\b|memoria ram/i.test(n) && !/\bssd\b|nvme/i.test(n)) {
      if (/\bddr3\b/i.test(n)) return no("componente", "memoria DDR3, obsoleta");
      const cap = capacidadMemoria(n);
      if (cap && cap < m.memoria) return no("componente", `solo ${cap} GB de memoria (mínimo ${m.memoria})`);
      const mhz = (x = n.match(/\b(\d{4,5})\s?mhz(?![a-z])/i)) ? +x[1] : 0;
      return ok("componente", /\bddr5\b/i.test(n) && cap >= m.memoriaAlta && mhz >= m.mhzAlta ? "alta" : "media");
    }
    if (/\bssd\b|nvme/i.test(n) && !/\bhdd\b/i.test(n)) {
      const cap = memoriaDe(n).rom || capacidadMemoria(n);
      if (cap && cap < m.ssd) return no("componente", `solo ${cap} GB (mínimo ${m.ssd})`);
      return ok("componente", /nvme|m\.?2/i.test(n) && /gen\s?[45]|pcie\s?[45]/i.test(n) && cap >= m.ssdAlta ? "alta" : "media");
    }
    if (/^\s*fuente|\bpsu\b|power supply/i.test(n) && (x = n.match(/\b(\d{3,4})\s?w\b/i))) {
      if (+x[1] < m.fuente) return no("componente", `solo ${x[1]} W (mínimo ${m.fuente})`);
      return ok("componente", +x[1] >= m.fuenteAlta && /gold|platinum|titanium/i.test(n) ? "alta" : "media");
    }
    return ok("componente", null);
  }

  /* { categoria, pasa, motivo?, nivel: "alta"|"media"|null, alta, vigente, rom, nota } */
  function evaluar(nombre, ref = { gen: {}, anio: 0, salto: {} }) {
    const c = categoriaDe(nombre);
    if (c === "monitor") return monitor(nombre);
    if (c === "smartphone" || c === "notebook" || c === "pc") return equipo(c, nombre, ref);
    if (c === "componente") return componente(nombre);
    return ok(c, null);
  }

  const api = { ORDEN, ETIQUETAS, ETIQUETA, DESCUENTO, CUPO, MIN, categoriaDe, memoriaDe, aspectosDe, generacionesDe, referencia, evaluar };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Categorias = api;
})(this);
