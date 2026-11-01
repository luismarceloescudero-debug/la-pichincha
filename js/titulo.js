/* El nombre de un aviso, legible (spec 044). Las tiendas publican titulos largos, en mayusculas o no, con el tipo de
   producto adelante («Notebook Gamer…»), codigos internos (005904), el color dos veces y las pulgadas como '' o ".
   Aca se parte en tres:
     - el TIPO, que se muestra como icono (o emoji en Telegram) en lugar de la palabra;
     - el TITULO: marca y modelo, en mayusculas («SAMSUNG ODYSSEY G8 G81SF»);
     - las CHIPS: solo lo que define la compra segun el tipo («27″ · 4K · QD-OLED · 240 Hz»).
   El nombre completo no se pierde (`completo`, con las pulgadas como ″): va en el title, en la ficha y en el link.
   Todo sale del titulo, como en especificaciones.js: lo que el titulo no dice no se inventa (principio II), y lo
   usado o reacondicionado se dice primero, como chip, aunque se saque del titulo.
   Funciones puras: no tocan el DOM ni la red; las usan el sitio, generar_feed.js (ofertas.json, /hoy/) y, por
   ofertas.json, Telegram e Instagram. */
(function (raiz) {
  "use strict";

  const C = typeof module === "object" && module.exports ? require("./categorias.js") : raiz.Categorias;

  /* --- El tipo y su icono --------------------------------------------------- */
  // En orden: lo primero que coincide gana. Se mira el principio del titulo; la categoria es el respaldo.
  const TIPOS = [
    ["placa-video", /^\s*(?:placa\s+de\s+v[ií]deo|tarjeta\s+(?:de\s+)?v[ií]deo|tarjeta\s+gr[aá]fica|vga|gpu)\b/i],
    ["mother", /^\s*(?:placa\s+madre|mother\s?board|mother|mainboard)\b/i],
    ["procesador", /^\s*(?:procesador|microprocesador|micro|cpu\s+(?:intel|amd))\b/i],
    ["memoria", /^\s*(?:memoria|ram|sodimm|kit\s+de\s+memoria)\b/i],
    ["disco", /^\s*(?:disco|ssd|hdd|hd\s+ssd|unidad\s+de\s+estado|pendrive)\b/i],
    ["fuente", /^\s*fuente\b/i],
    ["gabinete", /^\s*gabinete\b/i],
    ["cooler", /^\s*(?:cooler(?!\s+master)|fan|disipador|refrigeraci[oó]n|water\s?cool(?:er|ing))\b/i],
    ["mouse", /^\s*(?:mouse|rat[oó]n)\b(?!\s?pad)/i],
    ["teclado", /^\s*teclado\b/i],
    ["auriculares", /^\s*(?:auricular(?:es)?|headset|vincha|in\s?ear|earbuds?)\b/i],
    ["parlante", /^\s*(?:parlantes?|barra\s+de\s+sonido|soundbar)\b/i],
    ["joystick", /^\s*(?:joystick|gamepad|control(?:ador)?|volante)\b/i],
    ["webcam", /^\s*(?:webcam|c[aá]mara\s+web)\b/i],
    ["router", /^\s*(?:router|access\s+point|repetidor|switch|mesh)\b/i],
    ["impresora", /^\s*impresora\b/i],
    ["silla", /^\s*silla\b/i],
    ["tv", /^\s*(?:smart\s?tv|televisor|tv)\b/i],
    ["tablet", /^\s*tablet\b|\bipad\b/i],
    ["reloj", /^\s*(?:smartwatch|reloj|smart\s?band)\b/i],
    ["consola", /^\s*consola\b|\b(?:playstation|ps5|xbox\s+series|nintendo\s+switch)\b/i],
  ];
  const POR_CATEGORIA = { smartphone: "celular", notebook: "notebook", monitor: "monitor", pc: "pc", componente: "componente", periferico: "accesorio", otro: "otro" };

  const GPU_SUELTA = /\b(?:rtx|gtx)\s?\d{3,4}\b|\bradeon\s+rx\b|\brx\s?\d{4}\b|\barc\s+[ab]\d{3}\b/i;

  function tipoDe(nombre, categoria = C.categoriaDe(nombre)) {
    const t = TIPOS.find(([, re]) => re.test(nombre));
    // Los equipos los dice la categoria (mira mas que el principio); un componente o periferico, su primera palabra.
    if (["smartphone", "notebook", "monitor", "pc"].includes(categoria) && !(t && t[0] === "tablet")) return POR_CATEGORIA[categoria];
    // Una placa sin «placa de video» al principio («GIGABYTE RTX 5080 16 GB», 31/10) tambien es una placa, no «Componente».
    if (!t && categoria === "componente" && GPU_SUELTA.test(nombre)) return "placa-video";
    return t ? t[0] : POR_CATEGORIA[categoria] || "otro";
  }

  // Trazos de 24x24, como los iconos del sitio (stroke, sin relleno).
  const ICONOS = {
    celular: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    tablet: '<rect x="4.5" y="3" width="15" height="18" rx="2"/><path d="M11 18h2"/>',
    notebook: '<rect x="5" y="5" width="14" height="10" rx="1"/><path d="M2.5 18.5h19l-1.5-3.5H4z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/>',
    tv: '<rect x="2.5" y="5" width="19" height="12" rx="1.5"/><path d="M7 21l2-4M17 21l-2-4"/>',
    pc: '<rect x="7" y="2.5" width="10" height="19" rx="1.5"/><path d="M10 6h4M10 9h4"/><circle cx="12" cy="16" r="1.5"/>',
    componente: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3"/>',
    procesador: '<rect x="7" y="7" width="10" height="10" rx="1.5"/><rect x="10" y="10" width="4" height="4"/><path d="M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3"/>',
    "placa-video": '<rect x="2.5" y="6" width="19" height="10" rx="1.5"/><circle cx="9" cy="11" r="3"/><circle cx="16" cy="11" r="2"/><path d="M5 16v3M8 16v2M11 16v2"/>',
    mother: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><rect x="7" y="7" width="5" height="5"/><path d="M15 7v10M18 7v10M7 15h5M7 18h5"/>',
    memoria: '<rect x="2.5" y="7" width="19" height="8" rx="1"/><path d="M6 10v2M9 10v2M12 10v2M15 10v2M18 10v2M5 15v2.5M8 15v2.5M16 15v2.5M19 15v2.5"/>',
    disco: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h6M7 14h3"/><circle cx="17" cy="12" r="1.2"/>',
    fuente: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><circle cx="10" cy="12" r="4"/><path d="M10 9v6M7 12h6M16.5 9h2M16.5 15h2"/>',
    gabinete: '<rect x="6" y="2.5" width="12" height="19" rx="1.5"/><path d="M9 6h6"/><circle cx="12" cy="13" r="3"/>',
    cooler: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5"/><path d="M12 10.5c-1-3 0-5.5 2.5-6M13.5 12c3-1 5.5 0 6 2.5M12 13.5c1 3 0 5.5-2.5 6M10.5 12c-3 1-5.5 0-6-2.5"/>',
    mouse: '<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M12 3v6M6 9h12"/>',
    teclado: '<rect x="2.5" y="6" width="19" height="12" rx="1.5"/><path d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h.01M18 14h.01M9 14h6"/>',
    auriculares: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>',
    parlante: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="14" r="3.5"/><circle cx="12" cy="7" r="1.2"/>',
    joystick: '<path d="M7 8h10a4 4 0 0 1 4 4v1.5a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.3A3 3 0 0 1 3 13.5V12a4 4 0 0 1 4-4z"/><path d="M8 10.5v3M6.5 12h3M15.5 11h.01M17.5 13h.01"/>',
    webcam: '<circle cx="12" cy="10" r="6"/><circle cx="12" cy="10" r="2.5"/><path d="M8 20h8M12 16v4"/>',
    router: '<rect x="3" y="13" width="18" height="6" rx="1.5"/><path d="M7 13l-1.5-6M17 13l1.5-6M7 16h.01M10 16h.01"/>',
    impresora: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
    silla: '<path d="M7 3h10v9H7zM5 12h14M12 12v5M7 21l5-4 5 4"/>',
    reloj: '<rect x="6.5" y="6" width="11" height="12" rx="2.5"/><path d="M9 6l.5-3.5h5L15 6M9 18l.5 3.5h5L15 18M12 10v2.5l1.5 1"/>',
    consola: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 10.5v3M5.5 12h3M16 11h.01M18 13h.01"/>',
    accesorio: '<path d="M12 3a4 4 0 0 1 4 4h2.5l1 13h-15l1-13H8a4 4 0 0 1 4-4z"/><path d="M9.5 7h5"/>',
    otro: '<path d="M3 12l9-9h8v8l-9 9z"/><circle cx="15.5" cy="8.5" r="1.5"/>',
  };
  const EMOJI = { celular: "📱", tablet: "📲", notebook: "💻", monitor: "🖥️", tv: "📺", pc: "🗄️", componente: "🧩", procesador: "🧩",
    "placa-video": "🎮", mother: "🧩", memoria: "💾", disco: "💽", fuente: "🔌", gabinete: "🗄️", cooler: "❄️", mouse: "🖱️",
    teclado: "⌨️", auriculares: "🎧", parlante: "🔊", joystick: "🎮", webcam: "📷", router: "📶", impresora: "🖨️", silla: "🪑",
    reloj: "⌚", consola: "🎮", accesorio: "🛍️", otro: "🏷️" };
  const NOMBRE_TIPO = { celular: "Celular", tablet: "Tablet", notebook: "Notebook", monitor: "Monitor", tv: "Televisor", pc: "PC",
    componente: "Componente", procesador: "Procesador", "placa-video": "Placa de video", mother: "Placa madre", memoria: "Memoria",
    disco: "Disco", fuente: "Fuente", gabinete: "Gabinete", cooler: "Refrigeración", mouse: "Mouse", teclado: "Teclado",
    auriculares: "Auriculares", parlante: "Parlante", joystick: "Joystick", webcam: "Webcam", router: "Router", impresora: "Impresora",
    silla: "Silla", reloj: "Reloj", consola: "Consola", accesorio: "Accesorio", otro: "Producto" };

  /* El icono como SVG suelto (sin depender del sprite de index.html): sirve igual en /hoy/ y en la imagen de Instagram. */
  const svg = (tipo, clase = "ico") =>
    `<svg class="${clase}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${NOMBRE_TIPO[tipo] || "Producto"}">${ICONOS[tipo] || ICONOS.otro}</svg>`;

  /* --- Las pulgadas ----------------------------------------------------------- */
  // 27'' · 27" · 27” · 27 pulgadas · 27 pulg. → 27″. Solo detras de un numero: unas comillas sueltas no son pulgadas.
  const pulgadas = s => String(s).replace(/(\d(?:[.,]\d)?)\s*(?:''|"|”|″|′′|pulgadas\b|pulg\b\.?|inch(?:es)?\b)/gi, "$1″");

  /* --- El procesador ---------------------------------------------------------- */
  // [regex, como se escribe]. El texto que coincide se saca del titulo de un equipo: va en las chips.
  const CPUS = [
    [/\b(?:amd\s+)?ryzen\s?(ai\s?)?(?:max\+?\s?)?([3579])(?:\s?pro)?[-\s]?(\d{3,4}[a-z]{0,3}\d?)?(?![a-z\d])/i, m => `Ryzen ${m[1] ? "AI " : ""}${m[2]}${m[3] ? " " + m[3].toUpperCase() : ""}`],
    [/\b(?:intel\s+)?core\s?ultra\s?([3579])\s?(\d{3}[a-z]{0,2})?(?![a-z\d])/i, m => `Core Ultra ${m[1]}${m[2] ? " " + m[2].toUpperCase() : ""}`],
    // Intel Core 5/7 de la serie 1 (2024): «Core 5 120U», «C5-120U»
    [/\b(?:intel\s+)?(?:core\s?|c)([357])[-\s](1\d{2}[a-z]{1,2})(?![a-z\d])/i, m => `Core ${m[1]} ${m[2].toUpperCase()}`],
    // «INTEL Ultra 5 125H», sin «Core»: con el modelo, para no confundirlo con un «Galaxy S25 Ultra»
    [/\b(?:intel\s+)?ultra\s?([3579])\s(\d{3}[a-z]{1,2})(?![a-z\d])/i, m => `Core Ultra ${m[1]} ${m[2].toUpperCase()}`],
    [/\b(?:intel\s+)?(?:core\s?)?i([3579])(?:[-\s_]?(\d{4,5}[a-z]{0,2}\d?))?(?![a-z\d])/i, m => `Core i${m[1]}${m[2] ? "-" + m[2].toUpperCase() : ""}`],
    [/\b(?:apple\s+)?(m[1-5])(\s?(?:pro|max|ultra))?(?![a-z\d])/i, m => `Apple ${m[1].toUpperCase()}${m[2] ? " " + m[2].trim().replace(/^./, c => c.toUpperCase()) : ""}`, /apple|macbook|imac|mac\s?mini|ipad/i],
    [/\b(?:intel\s+|amd\s+)?(celeron|pentium|athlon)\s?([a-z]?\d{3,5}[a-z]?)?(?![a-z\d])/i, m => m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() + (m[2] ? " " + m[2].toUpperCase() : "")],
    // Como los abrevia OnCity: «R7-7730U» es un Ryzen 7 y «U5-115U» un Core Ultra 5 (056: hacian de modelo en el titulo)
    [/\br([3579])-(\d{3,4}[a-z]{0,2})(?![a-z\d])/i, m => `Ryzen ${m[1]} ${m[2].toUpperCase()}`],
    [/\bu([3579])-(\d{3}[a-z]{0,2})(?![a-z\d])/i, m => `Core Ultra ${m[1]} ${m[2].toUpperCase()}`],
    [/\b(snapdragon|dimensity|helio|exynos)\s?([a-z]?\d{3,4}\+?|\d\s?gen\s?\d)?/i, m => m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() + (m[2] ? " " + m[2].replace(/\s+/g, " ") : "")],
  ];
  const cpuMatch = n => { for (const [re, f, si] of CPUS) { const m = n.match(re); if (m && (!si || si.test(n))) return { texto: m[0], cpu: f(m) }; } return null; };
  const cpu = n => (cpuMatch(n) || {}).cpu || "";
  const GPU = /\b(?:nvidia\s+|amd\s+)?(?:geforce\s+|radeon\s+)?(rtx|gtx|rx|arc)\s?([a-z]?\d{3,4})\s?(ti\s?super|ti|super|xtx|xt|gre)?(?![a-z\d])/i;
  function gpu(n) {
    const m = n.match(GPU);
    return m ? [m[1].toUpperCase(), m[2].toUpperCase(), (m[3] || "").toUpperCase().replace(/\s+/g, " ")].filter(Boolean).join(" ") : "";
  }

  /* --- El titulo: marca y modelo ---------------------------------------------- */
  // Lo que va adelante y el icono ya dice (o no suma): se saca del principio.
  const PREFIJO = new RegExp("^\\s*(?:(?:" + [
    "celular(?:es)?", "smartphone", "ordenador", "tel[eé]fono(?:\\s+celular)?", "notebook", "laptop", "netbook", "ultrabook", "port[aá]til",
    "monitor(?:\\s+led)?", "smart\\s?tv", "televisor", "tv", "pc(?:\\s+de\\s+escritorio)?", "computadora", "equipo\\s+armado",
    "all\\s?in\\s?one", "placa\\s+de\\s+v[ií]deo", "tarjeta\\s+(?:de\\s+)?v[ií]deo", "tarjeta\\s+gr[aá]fica", "placa\\s+madre",
    "mother\\s?board", "mother", "mainboard", "micro(?:procesador)?", "procesador", "cpu", "memoria(?:\\s+ram)?", "ram",
    "kit\\s+de\\s+memoria", "disco(?:\\s+s[oó]lido|\\s+r[ií]gido)?", "hd", "ext(?:erno)?\\.?", "unidad\\s+de\\s+estado\\s+s[oó]lido",
    "pendrive", "fuente(?:\\s+de\\s+alimentaci[oó]n)?", "gabinete", "(?:mid|full|mini)\\s+tower", "cooler(?!\\s+master)",
    "water\\s?cool(?:er|ing)", "fans?", "disipador", "mouse\\s?pad", "mouse", "rat[oó]n", "teclado", "auricular(?:es)?", "headset",
    "parlantes?", "barra\\s+de\\s+sonido", "joystick", "gamepad", "control(?:ador)?", "volante", "webcam", "c[aá]mara\\s+web",
    "router", "impresora", "silla", "tablet", "smartwatch", "reloj(?:\\s+inteligente)?", "consola", "gamer", "gaming",
    "mini\s?pc", "pc\s+armada", "armad[ao]", "c\/\s?micr[oó]fono", "inal[aá]mbric[oa]s?", "wireless", "mec[aá]nico", "ergon[oó]mico", "curvo", "ultrawide", "de", "para", "con", "y", "nuevo",
    "nueva", "original", "oficial", "-", "–"].join("|") + ")(?![\\w\\u00C0-\\u017F])\\s*)+", "i");

  const COLORES = /^(?:negro|negra|black|blk|blanco|blanca|white|gris|gray|grey|plata|plateado|silver|azul|blue|navy|celeste|rojo|roja|red|verde|green|rosa|rose|pink|violeta|lila|purple|dorado|gold|amarillo|yellow|naranja|orange|grafito|graphite|titanio|titanium|lavanda|lavender|mint|midnight|starlight|beige|marron|cream|crema|onyx|shadow|phantom|obsidian|ice|jet|cosmic|aurora|oscuro|claro)$/i;
  // Un token que ya es un dato (va en las chips) o ruido: el titulo termina antes.
  const DATO = [
    /^\d+(?:[.,]\d+)?″$/, /^\d+(?:[.,]\d+)?(?:gb|tb|mb)$/i, /^\d{1,3}(?:[.,]\d+)?(?:g|t)$/i, /^\d+\/\d+(?:gb|g|tb)?$/i, /^\d+\+\d+/,
    /^(?:ssd|hdd|nvme|ram|ddr\d?)\d+(?:gb|tb)$/i,   // «SSD512GB», «RAM16GB»: tipo y capacidad pegados (31/10: «HP SSD512GB 250»)
    /^\(?\d+\s?x\s?\d+(?:mm|cm)?\)?$/i, /^\d{2,3}%$/,
    /^\d+(?:[.,]\d+)?(?:hz|mhz|ghz|ms|w|mah|mp|dpi|v|mm|cm|mt|kg|rpm|db|mt\/s)$/i, /^\d+(?:[.,]\d+)$/,
    /^(?:4k|5k|8k|uhd|fhd|qhd|wqhd|uwqhd|wqxga|wuxga|hd\+?|full|2k|2\.5k|1080p|1440p|2160p|720p)$/i,
    /^(?:qd-?oled|oled|amoled|qled|neo|super|ips|va|tn|mini-?led|miniled|led|lcd|retina)$/i,
    /^(?:[2345]g|lte|nfc|dual|sim|esim|wi-?fi\d*(?:-?e)?|wifi\d?e?|wf\d?e?|bluetooth|bt|usb(?:-c)?|tipo-?c|type-?c|hdmi|dp|displayport)$/i,
    /^(?:ddr\d|gddr\d|lpddr\d+x?|nvme|m\.2|sata|pcie|gen\d|am[345]|lga\d+|s1[27]\d\d|socket|atx|matx|m-atx|micro-atx|itx|mini-itx|e-atx)$/i,
    /^(?:ram|rom|ssd|hdd|emmc|memoria|almacenamiento|gb|tb|so-?dimm|u?dimm|mhz|ghz|hz|mah|dpi|nucleos|núcleos|cores|hilos|turbo|smartphone|celular|notebook|laptop)$/i,
    /^(?:win\d*\w*|w1[01]\w*|windows|freedos|free|dos|linux|android|ios|chromeos|macos|sistema|operativo)$/i,
    /^\d+(?:gb|mb)\/s$/i, /^(?:gamer|gaming|mid|tower|switch|fans?|\d+fans?|tkl|vga|s\/\w*|c\/\w*)$/i,
    /^(?:g-?sync|freesync|hdr\d*|rgb|argb|backlight|retroiluminado|bateria|batería|recargable|inalambrico|inalámbrico|wireless|mecanico|mecánico)$/i,
    /^(?:con|c\/|de|para|y|sin|s\/|en|el|la|los|las|-|–|\||\/|\+|,|garantia|garantía|gtia|oficial|nuevo|nueva|original|ed\.?|edicion|edición|reacondicionad[oa]|usad[oa]|renewed|refurbished|outlet)$/i,
  ];
  // En una placa de video la marca del chip no suma al titulo: «MSI NVIDIA GEFORCE RTX 5070 TI» → «MSI RTX 5070 TI».
  const RELLENO_GPU = /^(?:nvidia|geforce|radeon)$/i;   // tambien en un procesador: «Ryzen 5 8500G Radeon»
  const esColor = t => t.split("/").every(c => COLORES.test(c));
  const esDato = t => esColor(t) || DATO.some(re => re.test(t));
  // Un codigo de modelo: letras y numeros juntos («G81SF», «GO27Q24A», «15AKP10»). Los numeros solos de 6 o mas cifras,
  // o de 5 que empiezan con 0 («005904»), son codigos internos de la tienda y no se muestran.
  const esCodigo = t => /^(?=.*[a-z])(?=.*\d)[a-z0-9][a-z0-9-]{2,}$/i.test(t);
  const esInterno = t => /^\d{6,}$/.test(t) || /^0\d{4,}$/.test(t) || /^\d{3}-\d{6}$/.test(t) || /^(?:sku|cod|cód|art)[:.]?\d*$/i.test(t);
  const MAX_PALABRAS = 5, MIN_PALABRAS = 2;
  // La marca de una linea que la tienda no escribe («Notebook ThinkPad T14 Gen 6», OnCity 31/10): se pone adelante.
  const MARCA_DE_LINEA = [[/^(?:thinkpad|thinkbook|ideapad|yoga|legion|loq)$/i, "LENOVO"], [/^(?:vivobook|zenbook|expertbook)$/i, "ASUS"],
    [/^(?:pavilion|victus|omen|probook|elitebook|zbook|omnibook)$/i, "HP"], [/^(?:inspiron|latitude|vostro|alienware)$/i, "DELL"],
    [/^(?:aspire|nitro|predator|travelmate|extensa)$/i, "ACER"], [/^(?:macbook|imac)$/i, "APPLE"]];

  function tituloDe(nombre, tipo) {
    const equipo = ["notebook", "pc", "celular", "tablet"].includes(tipo);
    let sin = pulgadas(nombre).replace(/[™®©]/g, "").replace(/\([^)]*\)|\[[^\]]*\]/g, " ").replace(/\b80\s?\+?\s?plus(?:\s+(?:bronze|silver|gold|platinum|titanium|white))?\b/gi, " ")
      .replace(/\bw(?:in(?:dows)?)?\s?1[01]\s?(?:home|pro|p)?\b/gi, " ").replace(/\bhdr\s?\d{2,4}\+?/gi, " ").replace(/\+/g, " ");
    // En un equipo el procesador y la placa de video van en las chips: se sacan del titulo.
    if (equipo) { const c = cpuMatch(sin); if (c) sin = sin.replace(c.texto, " "); sin = sin.replace(GPU, " ").replace(/\b(?:intel|amd|nvidia)\b/gi, " "); }
    sin = sin.replace(PREFIJO, "");
    const toks = sin.split(/\s+/).map(t => t.replace(/^[,;:.\-–|+]+|[,;:|+]+$/g, "")).filter(Boolean);
    const vistas = new Set(), titulo = [];
    let i = 0, corte = -1;
    for (; i < toks.length && titulo.length < MAX_PALABRAS; i++) {
      const t = toks[i], k = t.toLowerCase(), sig = toks[i + 1] || "";
      if (esInterno(t) || vistas.has(k) || ((tipo === "placa-video" || tipo === "procesador") && RELLENO_GPU.test(t))) continue;
      // Un numero suelto seguido de su unidad («256 Gb», «12 Ram») ya es un dato; en un monitor, un numero de 15 a 65
      // son las pulgadas («LG 27 UltraGear»), y en una memoria uno de 4 cifras, los MHz («DDR5 5600»).
      const numero = /^\d+(?:[.,]\d+)?$/.test(t);
      const dato = esDato(t) || (numero && /^(?:gb|tb|g|hz|mhz|ghz|w|ram|ms|mah|dpi|″)$/i.test(sig))
        || (numero && (tipo === "monitor" || tipo === "tv") && +t.replace(",", ".") >= 15 && +t.replace(",", ".") <= 100)
        || (numero && tipo === "memoria" && t.length === 4);
      if (dato) {
        // Antes de tener marca y modelo, el dato se saltea; despues, el titulo termina (lo que sigue es ficha).
        if (titulo.length >= MIN_PALABRAS || (titulo.length && titulo.some(x => /\d/.test(x)))) { corte = i; break; }
        if (corte < 0 && titulo.length) corte = i;
        continue;
      }
      vistas.add(k);
      titulo.push(t);
    }
    // Sin un codigo de modelo («Monitor GIGABYTE 27″ QD-OLED … GO27Q24A»), se busca mas adelante.
    if (titulo.length && titulo.length < MAX_PALABRAS && !titulo.some(t => /\d/.test(t))) {
      // Un part number largo («RZ03-03392900-R311») no ayuda a leer: solo codigos cortos.
      // Un codigo de dos («V3») solo vale con la sigla de la linea delante, en mayusculas: «MWE V3» (Cooler Master, 056).
      const corto = k => /^[a-z]\d$/i.test(toks[k]) && k > i && /^[A-Z]{2,}$/.test(toks[k - 1]) && !esDato(toks[k - 1]) && !vistas.has(toks[k - 1].toLowerCase());
      const j = toks.findIndex((t, k) => k >= i && (esCodigo(t) || corto(k)) && t.length <= 10 && !esDato(t) && !esInterno(t) && !vistas.has(t.toLowerCase()));
      if (j >= 0) { if (corto(j)) titulo.push(toks[j - 1]); titulo.push(toks[j]); }
    }
    const linea = titulo.length && MARCA_DE_LINEA.find(([re, marca]) => re.test(titulo[0]) && !titulo.some(t => t.toUpperCase() === marca));
    if (linea) titulo.unshift(linea[1]);
    return (titulo.length ? titulo.join(" ") : (sin.trim() || pulgadas(nombre).trim()).split(/\s+/).slice(0, 4).join(" ")).toUpperCase();
  }

  /* --- Las chips: lo que define la compra ------------------------------------- */
  const gb = n => n >= 1000 ? `${+(n / 1000).toFixed(1)} TB` : `${n} GB`;
  // Solo con la marca de pulgadas: «12 Ram» no es una pantalla de 12″.
  const pulg = n => { const m = pulgadas(n).match(/(?:^|[^\d.])(\d{1,2}(?:\.\d)?)″/); return m ? `${+m[1]}″` : ""; };
  const resolucion = n => /\b(?:3440\s?x\s?1440|uwqhd)\b/i.test(n) ? "UWQHD" : /\b(?:5k)\b/i.test(n) ? "5K"
    : /\b(?:4k|uhd|2160p?|3840\s?x\s?2160)\b/i.test(n) ? "4K" : /\b(?:wqxga|2560\s?x\s?1600|2\.5k)\b/i.test(n) ? "2.5K"
    : /\b(?:qhd|wqhd|2k|1440p?|2560\s?x\s?1440)\b/i.test(n) ? "QHD" : /\b(?:fhd|full\s?hd|1080p?|1920\s?x\s?1080|wuxga)\b/i.test(n) ? "FHD" : "";
  const panel = n => {
    if (/qd-?\s?oled/i.test(n)) return "QD-OLED";
    if (/mini-?\s?led/i.test(n)) { const z = n.match(/(\d[\d.]{2,6})\s*(?:zonas|zones|dimming)/i); return "Mini LED" + (z ? ` ${z[1]} zonas` : ""); }
    if (/\bamoled\b/i.test(n)) return "AMOLED";
    if (/\boled\b/i.test(n)) return "OLED";
    if (/\bqled\b/i.test(n)) return "QLED";
    if (/\bips\b/i.test(n)) return "IPS";
    if (/\bva\b/i.test(n)) return "VA";
    return "";
  };
  const hz = n => { const t = [...new Set([...String(n).matchAll(/\b(\d{2,3})\s?hz(?![a-z])/gi)].map(x => +x[1]))].sort((a, b) => a - b); return t.length ? `${t.join("/")} Hz` : ""; };
  const memoria = n => C.memoriaDe(n.replace(/(\d+)\s*\/\s*(\d+)\s*(gb|g)\b/i, "$1GB $2GB").replace(/\b(\d{1,2})\s*(?:gb\s*)?(?:de\s+)?ram\b/i, "$1GB RAM"));
  const socket = n => { const m = n.match(/\b(am[345])\b|\b(?:lga|socket|s)\s?(1[2-9]\d\d)\b/i); return m ? (m[1] ? m[1].toUpperCase() : `LGA${m[2]}`) : ""; };
  const conectividad = n => [/inal[aá]mbric|wireless/i.test(n) ? "Inalámbrico" : "", /bluetooth|\bbt\b/i.test(n) ? "Bluetooth" : "",
    /usb-?c|tipo-?c|type-?c/i.test(n) ? "USB-C" : ""].filter(Boolean);
  const estado = n => /reacondicionad|renewed|refurbish/i.test(n) ? "Reacondicionado" : /\busad[oa]\b|caja\s+abierta|open\s?box/i.test(n) ? "Usado" : "";
  const lleno = arr => [...new Set(arr.filter(Boolean))];

  function chipsDe(nombre, tipo) {
    const n = pulgadas(nombre).replace(/(\d),(\d)/g, "$1.$2");
    return lleno([estado(n), ...chipsTipo(n, tipo)]).slice(0, 5);
  }
  function chipsTipo(n, tipo) {
    const m = memoria(n);
    let x;
    switch (tipo) {
      case "monitor": {
        const bare = (x = n.match(/(?:^|\s)(1[5-9]|[2-5]\d|6[0-5])(?:\.(\d))?(?=\s|$)/)) ? `${x[1]}${x[2] ? "." + x[2] : ""}″` : "";
        return [pulg(n) || bare, resolucion(n), panel(n), hz(n)];
      }
      case "tv": return [pulg(n), resolucion(n), panel(n)];
      case "notebook": case "pc": {
        const pantalla = tipo === "notebook" ? [pulg(n), /oled/i.test(n) ? panel(n) : "", hz(n)].filter(Boolean).join(" ") : "";
        return [cpu(n), gpu(n), m.ram ? `${m.ram} GB RAM` : "", m.rom ? `${gb(m.rom)} SSD` : "", pantalla];
      }
      case "celular": case "tablet":
        return [m.ram && m.rom ? `${m.ram}/${gb(m.rom)}` : m.rom ? gb(m.rom) : "", /\b5g\b/i.test(n) ? "5G" : "",
          pulg(n), /amoled|oled/i.test(n) ? panel(n) : "", cpu(n)].slice(0, 4);
      case "placa-video": return [(x = n.match(/\b(\d{1,2})\s?gb\b/i)) ? `${x[1]} GB` : "", (x = n.match(/\bg?ddr(\d)x?\b/i)) ? x[0].toUpperCase() : ""];
      case "procesador": return [socket(n), (x = n.match(/\b(\d{1,2})\s?(?:nucleos|núcleos|cores|c)\b/i)) ? `${x[1]} núcleos` : "",
        (x = n.match(/\b(\d(?:\.\d{1,2})?)\s?ghz\b/i)) ? `${+x[1]} GHz` : ""];
      case "mother": return [socket(n), (x = n.match(/\bddr([345])\b/i)) ? `DDR${x[1]}` : "",
        (x = n.match(/\b(e-atx|micro-?atx|m-?atx|mini-?itx|itx|atx)\b/i)) ? ({ "MICRO-ATX": "mATX", "MICROATX": "mATX", "M-ATX": "mATX", "MATX": "mATX" }[x[1].toUpperCase()] || x[1].toUpperCase()) : "",
        /wi-?fi|\bwf\d/i.test(n) ? "Wi-Fi" : ""];
      case "memoria": return [(x = n.match(/\b(\d{1,3})\s?gb\b/i)) ? `${x[1]} GB` : "", (x = n.match(/\bddr([345])\b/i)) ? `DDR${x[1]}` : "",
        (x = n.match(/\b(\d{4,5})\s?(?:mhz|mt\/s)\b/i) || n.match(/\bddr[345]\s+(\d{4})\b/i)) ? `${x[1]} MHz` : "",
        (x = n.match(/\bcl\s?(\d{2})\b/i)) ? `CL${x[1]}` : "", /so-?dimm/i.test(n) ? "SODIMM" : ""];
      case "disco": return [(x = n.match(/\b(\d{1,4})\s?(gb|tb)\b/i)) ? gb(x[2].toLowerCase() === "tb" ? +x[1] * 1000 : +x[1]) : "",
        /nvme/i.test(n) ? "NVMe" : /\bm\.?2\b/i.test(n) ? "M.2" : /\bsata\b/i.test(n) ? "SATA" : "", (x = n.match(/\b(?:gen|pcie)\s?([345])\b/i)) ? `Gen${x[1]}` : "",
        /\bhdd\b|r[ií]gido/i.test(n) ? "HDD" : "", /\bext(?:erno)?\b|usb/i.test(n) && !/m\.?2/i.test(n) ? "Externo" : ""];
      case "fuente": return [(x = n.match(/\b(\d{3,4})\s?w\b/i)) ? `${x[1]} W` : "",
        (x = n.match(/\b(bronze|silver|gold|platinum|titanium)\b/i)) ? `80+ ${x[1][0].toUpperCase()}${x[1].slice(1).toLowerCase()}` : /80\s?\+?\s?plus/i.test(n) ? "80+" : "",
        /modul/i.test(n) ? (/semi/i.test(n) ? "Semimodular" : "Modular") : ""];
      case "mouse": return [...conectividad(n), (x = n.match(/\b(\d{3,5})\s?dpi\b/i)) ? `${x[1]} DPI` : "", /\brgb\b/i.test(n) ? "RGB" : ""];
      case "teclado": return [/mec[aá]nic/i.test(n) ? "Mecánico" : "", ...conectividad(n),
        (x = n.match(/\b(60|65|75|tkl)\s?%?(?![\w])/i)) ? (/\d/.test(x[1]) ? `${x[1]}%` : "TKL") : "", /\brgb\b/i.test(n) ? "RGB" : ""];
      case "auriculares": case "parlante": return [...conectividad(n), /\banc\b|cancelaci[oó]n/i.test(n) ? "ANC" : "", (x = n.match(/\b(\d{1,3})\s?w\b/i)) ? `${x[1]} W` : ""];
      default: return [...conectividad(n), (x = n.match(/\b(\d{1,4})\s?(gb|tb)\b/i)) ? `${x[1]} ${x[2].toUpperCase()}` : "", pulg(n)];
    }
  }

  /* { categoria, tipo, titulo, chips, completo, emoji, etiqueta } */
  function de(nombre) {
    const original = String(nombre || "");
    const categoria = C.categoriaDe(original);
    const tipo = tipoDe(original, categoria);
    return { categoria, tipo, titulo: tituloDe(original, tipo), chips: chipsDe(original, tipo), completo: pulgadas(original).replace(/[\s.]+$/, ""),
      emoji: EMOJI[tipo], etiqueta: NOMBRE_TIPO[tipo] };
  }

  /* Una linea de texto plano: «💻 LENOVO LEGION 5 15AKP10 · Ryzen AI 7 350 · RTX 5050» (feed, Telegram). */
  const linea = (nombre, { emoji = true } = {}) => { const t = de(nombre); return [(emoji ? t.emoji + " " : "") + t.titulo, ...t.chips].join(" · "); };

  /* El nombre para una pagina: icono, titulo y chips. `esc` es el escape de quien lo pinta (base.js o generador.js).
     El nombre completo queda en el title, para quien quiera leerlo entero. */
  const html = (nombre, esc) => {
    const t = de(nombre);
    return `<span class="tit" title="${esc(t.completo)}">${svg(t.tipo, "ico tit-ico")}<span class="tit-txt"><b class="tit-nom">${esc(t.titulo)}</b>`
      + (t.chips.length ? `<span class="tit-chips">${t.chips.map(c => `<span class="tit-chip">${esc(c)}</span>`).join("")}</span>` : "")
      + `</span></span>`;
  };

  const api = { de, tipoDe, tituloDe, chipsDe, pulgadas, svg, linea, html, ICONOS, EMOJI, NOMBRE_TIPO };
  if (typeof module === "object" && module.exports) module.exports = api;
  else raiz.Titulo = api;
})(this);
