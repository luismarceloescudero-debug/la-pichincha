/* Puntaje premium por categoria (spec 014): que tan "de punta" es un producto por lo que dice su TITULO, sin mirar la marca.
   La marca no es calidad de construccion, materiales ni tecnologia (aclaracion del dueño, 20/10/2026): Primera Linea sale de
   aca, no de datos.json -> marcas.primera. Cada señal suma puntos y devuelve su texto, para poder decir POR QUE es premium.
   UMBRAL se fijo midiendo el indice publicado del 20/10/2026 (tabla en specs/014-ofertas-y-premium/spec.md): Primera Linea
   tiene que ser selectiva, no mas de ~25% de cada categoria.
   Categorias sin puntaje (perifericos y "otro"): no hay premium; Primera Linea no los incluye y lo dice. Lo que el titulo no
   dice no se inventa. Los ganadores en pruebas reales (datos/ganadores.json) suman cuando el archivo existe. */
(function (raiz) {
  "use strict";

  const C = typeof module === "object" && module.exports ? require("./categorias.js") : raiz.Categorias;

  /* Puntos desde los que un producto es "premium" en su categoria. */
  const UMBRAL = { smartphone: 3, notebook: 4, pc: 4, monitor: 3, componente: 3 };
  /* La memoria (RAM, almacenamiento, DDR5) es lo mas barato de agregar a un equipo: suma hasta TOPE_MEMORIA y nunca alcanza
     sola; hace falta ademas tecnologia o construccion (procesador, pantalla, generacion, bateria, materiales...). */
  const TOPE_MEMORIA = 2, MIN_TECNOLOGIA = 2;
  const PUNTOS_GANADOR = 3;

  const hzDe = n => { const m = [...String(n).matchAll(/\b(\d{2,3})\s?hz(?![a-z])/gi)].map(x => +x[1]); return m.length ? Math.max(...m) : 0; };
  const MATERIAL = /titanio|titanium|aluminio|magnesio|fibra de carbono|vidrio|ceramic|cerámic/i;
  const CHIP_ALTO = /snapdragon\s?8\s?(?:gen|elite)|dimensity\s?9\d{3}|tensor\s?g[3-9]|exynos\s?2[4-9]\d{2}/i;

  const nivelCpu = n => { let m;
    if ((m = n.match(/\bcore\s?ultra\s?([3579])/i)) || (m = n.match(/\bryzen\s?(?:ai\s?)?([3579])\b/i)) || (m = n.match(/\b[ir]([3579])[-\s]?\d{4,5}[a-z]{0,2}\b/i))
      || (m = n.match(/\b[ur]([3579])-\d{3}[a-z]{0,2}\b/i))) return +m[1];   // «U7-366H» (Core Ultra 7) y «R7-250» (Ryzen 7), como los escribe OnCity
    if (/\bm[1-9]\s?(?:pro|max|ultra)\b/i.test(n)) return 9;
    return /\bm[1-9]\b/i.test(n) ? 5 : 0; };

  /* Las señales del titulo: [puntos, texto]. `ref` es C.referencia(indice): sirve para saber que es la ultima generacion. */
  function senalesDe(nombre, categoria, ref, gama) {
    const n = String(nombre), s = [], add = (p, t, mem) => s.push([p, t, !!mem]);
    const { ram, rom } = C.memoriaDe(n), hz = hzDe(n);
    const oled = /\bamoled|\boled\b/i.test(n), nuevo = C.generacionesDe(n).some(g => g.gen >= (ref.gen[g.fam] || g.gen));
    let m;
    if (categoria === "smartphone") {
      if (ram >= 12) add(2, `${ram} GB de RAM`, 1); else if (ram >= 8) add(1, `${ram} GB de RAM`, 1);
      if (rom >= 512) add(2, `${rom} GB de almacenamiento`, 1); else if (rom >= 256) add(1, `${rom} GB de almacenamiento`, 1);
      if (CHIP_ALTO.test(n) || (/\biphone\b/i.test(n) && /\ba(?:1[7-9]|[2-9]\d)\b/i.test(n))) add(2, "procesador de punta");
      if (nuevo) add(2, "última generación");
      if (oled && hz >= 120) add(2, `pantalla OLED de ${hz} Hz`); else if (oled) add(1, "pantalla OLED"); else if (hz >= 120) add(1, `pantalla de ${hz} Hz`);
      if ((m = n.match(/\b(\d{4,5})\s?mah(?![a-z])/i)) && +m[1] >= 5500) add(1, `batería de ${m[1]} mAh`);
      if ((m = n.match(/\b(\d{2,3})\s?w(?![a-z])/i)) && +m[1] >= 65) add(1, `carga de ${m[1]} W`);
      if ((m = n.match(/\b(\d{2,3})\s?mp(?![a-z])/i)) && +m[1] >= 108) add(1, `cámara de ${m[1]} MP`);
      if (/\b(?:pro|ultra|max|fold|flip)\b/i.test(n)) add(1, "línea alta del modelo");
      if (MATERIAL.test(n)) add(1, "materiales de gama alta");
      if ((m = n.match(/\b(\d{1,2})\s*(?:años|anos|years?)\s*(?:de\s*)?(?:actualizaciones|updates?|soporte)/i)) && +m[1] >= 7) add(1, `${m[1]} años de actualizaciones`);
    } else if (categoria === "notebook" || categoria === "pc") {
      if (ram >= 32) add(2, `${ram} GB de RAM`, 1); else if (ram >= 16) add(1, `${ram} GB de RAM`, 1);
      if (rom >= 2000) add(2, "almacenamiento de 2 TB", 1); else if (rom >= 1000) add(1, "almacenamiento de 1 TB", 1);
      const cpu = nivelCpu(n);
      if (cpu >= 9) add(3, "procesador de punta"); else if (cpu >= 7) add(1, "procesador de gama alta");
      if (/ryzen\s?ai|core\s?ultra|snapdragon\s?x|\bu[3579]-\d{3}[a-z]{0,2}\b/i.test(n)) add(1, "procesador con NPU");
      if ((m = n.match(/\brtx\s?(\d{4})/i)) && +m[1] >= 4000) {
        if (+m[1] % 1000 >= 70) add(3, `placa RTX ${m[1]}`); else if (+m[1] % 1000 >= 60) add(2, `placa RTX ${m[1]}`);
      }
      // las placas de estacion de trabajo (RTX 500 a 5000 Ada/Blackwell, en una ZBook o una ThinkPad P): certificadas para uso profesional
      if ((m = n.match(/\brtx\s?(?:pro\s?)?([1-5]?000|500)(?:\s?ada|\s?blackwell)?\b/i))) add(2, `placa profesional RTX ${m[1]}`);
      if (oled) add(2, "pantalla OLED"); else if (/\b(?:2\.?5k|qhd|wqxga|2k|3k|4k|wuxga)\b/i.test(n)) add(1, "resolución alta");
      if (hz >= 120) add(1, `pantalla de ${hz} Hz`);
      if (nuevo) add(2, "última generación");
      if (/\b(?:lp)?ddr5\b/i.test(n)) add(1, "memoria DDR5", 1);
      if (MATERIAL.test(n)) add(1, "materiales de gama alta");
      if (/wi-?fi\s?7|thunderbolt/i.test(n)) add(1, "conectividad reciente");
    } else if (categoria === "monitor") {
      if (/qd-?\s?oled/i.test(n)) add(4, "panel QD-OLED"); else if (oled) add(3, "panel OLED"); else if (/mini-?\s?led/i.test(n)) add(3, "panel Mini-LED");
      if (/\b(?:4k|uhd|2160p)\b/i.test(n)) add(2, "resolución 4K"); else if (/\b(?:2\.?5k|qhd|wqhd|1440p|2k)\b/i.test(n)) add(1, "resolución 2.5K");
      if (hz >= 240) add(2, `${hz} Hz`); else if (hz >= 165) add(1, `${hz} Hz`);
      if (/hdr\s?(?:600|1000|1400)|displayhdr\s?(?:600|1000|1400)/i.test(n)) add(1, "HDR real");
      if (/thunderbolt/i.test(n)) add(1, "conectividad reciente");
    } else if (categoria === "componente" && /^\s*fuente\b|\bpsu\b|power supply/i.test(n)) {
      // Una fuente (056): 750 W Gold es la gama media de hoy y casi todas traen el conector PCIe 5.1 (ATX 3.1). Lo premium es la
      // eficiencia (Platinum, Titanium); la potencia grande suma poco. Antes salian premium el 44 % de las fuentes del indice.
      if (gama && gama.nivel === "alta") add(1, "gama alta de su tipo");
      if ((m = n.match(/\b(platinum|titanium)\b/i))) add(3, `certificación ${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}`);
      if ((m = n.match(/\b(\d{4})\s?w\b/i)) && +m[1] >= 1000) add(1, `${m[1]} W`);
    } else if (categoria === "componente") {
      if (gama && gama.nivel === "alta") add(3, "gama alta de su tipo");
      if ((m = n.match(/\brtx\s?(\d{4})/i))) {
        if (+m[1] >= 5000) add(2, "última generación de placas");
        if (+m[1] % 1000 >= 70) add(2, "placa de gama alta");
      }
      if (/ryzen\s?[79]\s?9\d{3}|core\s?ultra\s?[79]|\bi[79][-\s]?1[4-9]\d{3}/i.test(n)) add(3, "procesador de punta");
      if (/pcie\s?5|gen\s?5\b/i.test(n)) add(2, "PCIe 5.0");
      if (/\bddr5\b/i.test(n) && ((m = n.match(/\b(\d{4,5})\s?mhz/i)) && +m[1] >= 6000)) add(1, "DDR5 rápida");
    }
    return s;
  }

  /* Un modelo que figura en datos/ganadores.json (pruebas reales de rendimiento, duracion y construccion; lo arma otra sesion,
     esquema en docs/ganadores-referencia.md): { ganadores: [{ modelo, alias: [...], fuente: { nombre, url }, confianza, ... }] }.
     Cuenta solo lo «confirmado». Coincide por el alias (o el modelo) como palabras enteras del titulo, el mas largo gana, y no si
     lo que sigue es otra variante (RTX 5080 SUPER no es la RTX 5080) ni si el chip del modelo (M5, A18) no esta en el titulo. */
  const norm = t => String(t).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const VARIANTES = new Set(["ti", "super", "xt", "xtx", "plus", "pro", "max", "ultra", "fe", "edge", "lite", "mini"]);
  function ganadorDe(nombre, ganadores) {
    const lista = Array.isArray(ganadores) ? ganadores : ganadores && Array.isArray(ganadores.ganadores) ? ganadores.ganadores : [];
    const n = " " + norm(nombre) + " ";
    let mejor = null;
    for (const g of lista) {
      if (!g || (g.confianza && g.confianza !== "confirmado")) continue;
      const chip = String(g.modelo || "").match(/\(([^)]*)\)/), chips = chip ? norm(chip[1]).split(" ").filter(t => /^[am]\d{1,2}$/.test(t)) : [];
      if (chips.some(c => !n.includes(" " + c + " "))) continue;
      for (const a of [...(g.alias || []), g.modelo]) {
        const alias = norm(a || "");
        if (alias.length < 4) continue;
        const i = n.indexOf(" " + alias + " ");
        if (i < 0) continue;
        const sigue = n.slice(i + alias.length + 2).split(" ")[0];
        if (VARIANTES.has(sigue) && !alias.endsWith(sigue)) continue;
        if (!mejor || alias.length > mejor.largo) {
          const fuente = typeof g.fuente === "string" ? g.fuente : (g.fuente && g.fuente.nombre) || "pruebas independientes";
          const corta = fuente.split(/[,(]/)[0].trim();
          mejor = { largo: alias.length, fuente: corta, modelo: g.modelo, puntaje: g.puntaje, texto: `ganador en pruebas: ${corta}` };
        }
      }
    }
    return mejor && { fuente: mejor.fuente, modelo: mejor.modelo, puntaje: mejor.puntaje, texto: mejor.texto };
  }

  /* { puntos, senales: [texto], premium, umbral, ganador }. Sin puntaje para perifericos ni "otro" (umbral 0). */
  function puntaje(nombre, ref, gama, ganadores) {
    const categoria = gama ? gama.categoria : C.categoriaDe(nombre), umbral = UMBRAL[categoria] || 0;
    const g = ganadorDe(nombre, ganadores);
    // sin puntaje por categoria (perifericos: auriculares), un ganador en pruebas es premium por si solo
    if (!umbral) return g ? { categoria, puntos: PUNTOS_GANADOR, senales: [g.texto], premium: true, umbral: 0, ganador: g }
      : { categoria, puntos: 0, senales: [], premium: false, umbral: 0, ganador: null };
    const s = senalesDe(nombre, categoria, ref || { gen: {}, anio: 0 }, gama);
    if (g) s.push([PUNTOS_GANADOR, g.texto]);
    const memoria = Math.min(TOPE_MEMORIA, s.filter(x => x[2]).reduce((a, x) => a + x[0], 0));
    const tecnologia = s.filter(x => !x[2]).reduce((a, x) => a + x[0], 0), puntos = memoria + tecnologia;
    // un producto que no llega al minimo de su gama no es premium por mas señales que sume; y la memoria sola no alcanza
    const premium = puntos >= umbral && (categoria === "componente" || categoria === "monitor" || tecnologia >= MIN_TECNOLOGIA) && (!gama || gama.pasa !== false);
    return { categoria, puntos, senales: s.map(x => x[1]), premium, umbral, ganador: g };
  }

  const api = { UMBRAL, TOPE_MEMORIA, MIN_TECNOLOGIA, PUNTOS_GANADOR, puntaje, ganadorDe };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Premium = api;
})(this);
