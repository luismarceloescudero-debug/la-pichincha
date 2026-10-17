#!/usr/bin/env python3
"""Codigo de modelo (part number) de un aviso, para agrupar el mismo producto entre tiendas.

Agrupar por nombre parecido ya se probo y fallo, asi que aca la regla es la contraria: un aviso tiene
codigo solo si el nombre trae uno con la forma de un part number de ese rubro; ante la duda no hay codigo
y el aviso queda suelto. Dos avisos son el mismo producto cuando el codigo coincide exacto.

Cada regla nueva entra con un nombre real en tests/test_modelo.py.
"""

import hashlib
import html
import re
import unicodedata

RUBROS = ("ram", "ssd", "gpu", "mb")

# Equipos y lotes que solo mencionan el componente: notebooks, PCs armadas, combos, discos mecanicos. Se miran por el
# PRINCIPIO del titulo: "Memoria RAM Notebook SODIMM" es una memoria que se usa en una notebook, no una notebook.
_NO_ES_COMPONENTE = re.compile(
    r"^\s*(notebook|laptop|macbook|ipad|celular|smartphone|pc|computadora|all in one|aio|combo|kit\s+(?:amd|intel|ryzen)|"
    r"monitor|auricular|auriculares|parlante|teclado|mouse)\b|\bpc gamer\b|rpm\b", re.I)

_RUBRO_POR_INICIO = (
    ("ram", re.compile(r"^\s*(memoria|memorias|ram|modulo|sodimm|so-?dimm|udimm|u-?dimm|dimm)\b", re.I)),
    ("ssd", re.compile(r"^\s*(hd ssd|hd m\.?2|disco solido|disco s.lido|disco ssd|ssd|unidad de estado solido)\b", re.I)),
    ("gpu", re.compile(r"^\s*(placa de v.{1,2}deo|tarjeta de v.{1,2}deo|tarjeta grafica|placa grafica|vga|gpu)\b", re.I)),
    ("mb", re.compile(r"^\s*(motherboard|mother|mb|placa madre|placa base|mainboard)\b", re.I)),
)

# Titulos que no empiezan por el rubro (el que arranca por la marca: "Hiksemi Hiker DDR4 32GB U-Dimm"): se reconocen por
# lo que son, y solo si no empiezan por otra cosa.
_MEMORIA_SUELTA = re.compile(r"\bddr[2345]\b.*\b\d{1,3}\s?(?:gb|g)\b|\b\d{1,3}\s?(?:gb|g)\b.*\bddr[2345]\b", re.I)
_OTRA_COSA = re.compile(r"\b(procesador|processor|ryzen|core\s?i[3579]|fuente|gabinete|cooler|disipador|placa|mother|motherboard|"
                        r"ssd|nvme|disco|rtx|gtx|geforce|radeon|monitor|pendrive|pen drive|micro sd|sd card)\b", re.I)
# Un equipo que no empieza por la palabra del equipo ("HP 15 Laptop Intel i5 8GB DDR4", "Dell Inspiron Notebook 8GB DDR4"):
# si el titulo no empieza por un componente, nombrar un equipo en cualquier lugar alcanza para que no sea un componente.
_EQUIPO_EN_CUALQUIER_LUGAR = re.compile(
    r"\b(notebook|laptop|netbook|chromebook|macbook|mini\s?pc|all\s?in\s?one|pc\s+(?:gamer|armada|de escritorio)|computadora|"
    r"celular|smartphone|tablet|consola)\b", re.I)

# Marcas de usado o de venta sin garantia de fabrica: no son el mismo producto que el nuevo.
# La misma lista que js/buscador.js (RE_USADO) mas lo que solo importa al agrupar (bulk, OEM).
_BLOQUEADOS = re.compile(
    r"\b(usad[oa]s?|seminuev[oa]s?|semi[ -]nuev[oa]s?|segunda mano|2da mano|reacondicionad[oa]s?|refurbished|refurb|open ?box|"
    r"caja[ -]?abierta|exhibici[oó]n|outlet|bulk|oem)\b", re.I)

# Forma de un part number por rubro. Solo formas conocidas: lo demas no se toma como codigo.
_FORMAS = {
    "ram": re.compile(
        r"^(KF[0-9]{3}[A-Z0-9\-/]+|KVR[0-9]{2}[A-Z0-9\-/]+|KCP[0-9]{3}[A-Z0-9\-/]+|KSM[0-9]{2}[A-Z0-9\-/]+|"
        r"KTD[A-Z0-9\-/]+|CM[A-Z][0-9]{1,2}[A-Z0-9\-/]+|CT[0-9]{1,3}G[0-9][A-Z0-9\-/]+|CT[0-9]{4,}[A-Z0-9\-/]+|"
        r"F[345]-[0-9]{3,4}[A-Z0-9\-]+|HS[A-Z][0-9]{3}[A-Z0-9\-/]+|HX[0-9]{3}[A-Z0-9\-/]+|PV[0-9A-Z]{6,}[A-Z0-9\-/]*|"
        r"TF[0-9][A-Z0-9\-/]+|TED[0-9][A-Z0-9\-/]+)$"),
    "ssd": re.compile(
        r"^(SEDC[0-9]{3}[A-Z]/[0-9]+G|SKC[0-9]{3,4}[A-Z]*/[0-9]+G|SNV[0-9][A-Z0-9]*/[0-9]+G|SA400S37/[0-9]+G|"
        r"SFYR[A-Z0-9]*/[0-9]+G|SNV3S/[0-9]+G|WDS[0-9]{3,4}[A-Z][0-9][A-Z0-9]+|MZ-[A-Z0-9]{4,}|"
        r"CT[0-9]+(P|BX|MX)[A-Z0-9]+|ZP[0-9]+[A-Z0-9]+|ST[0-9]+[A-Z]{2}[0-9]+|SDSS[A-Z0-9\-]+|SDSSD[A-Z0-9\-]+)$"),
    "gpu": re.compile(
        r"^(GV-[A-Z0-9\-]+|(DUAL|TUF|PRIME|ROG|PROART)-[A-Z0-9\-]+|[0-9]{2}[A-Z]-P[0-9]-[0-9]{4}-[A-Z]{2}|"
        r"912-V[0-9]{3}-[0-9]{3}|ZT-[A-Z][0-9]{4}[A-Z0-9\-]+|VCG[A-Z0-9]+|[0-9]{5}-[0-9]{2}-[0-9]{2}G)$"),
}

# Lo que parece codigo pero es una especificacion.
_ESPECIFICACION = re.compile(
    r"^[0-9]+(MB|GB|TB|MHZ|HZ|RPM|BIT|W|V)(/S)?$|MB/S$|GB/S$|MHZ$|^(DDR|PCIE|GEN|NVME|SATA|CL)[0-9]", re.I)

_TOKEN = re.compile(r"[A-Za-z0-9][A-Za-z0-9/\-\.]*[A-Za-z0-9]")


def normalizar(nombre):
    """El nombre como lo escribiria cualquier tienda: sin entidades HTML, con un solo tipo de guion y de espacio.
    Cada tienda publica el mismo producto con otra tipografia (un guion largo, un espacio duro, una comilla de
    pulgadas distinta); eso no puede decidir si dos avisos son el mismo."""
    t = unicodedata.normalize("NFKC", html.unescape(str(nombre)))
    t = re.sub(r"[\u2010-\u2015\u2212]", "-", t)
    t = re.sub(r"\u2032\u2032|\u2033|[\u201c\u201d]|''", '"', t)         # todas las comillas de pulgadas son una
    t = re.sub(r"\s+", " ", t.replace("\u00a0", " ")).strip()
    return re.sub(r"\s*\(\d{3,6}\)$", "", t)         # el codigo interno que algunas tiendas dejan al final: "... 2xHDMI (3242)"


def rubro_de(nombre):
    """ram, ssd, gpu o mb si el aviso ES ese componente (no una notebook que lo trae); si no, None."""
    nombre = normalizar(nombre)
    if _NO_ES_COMPONENTE.search(nombre):
        return None
    encontrados = [r for r, rx in _RUBRO_POR_INICIO if rx.search(nombre)]
    if len(encontrados) == 1:
        return encontrados[0]
    if _EQUIPO_EN_CUALQUIER_LUGAR.search(nombre):
        return None
    if not encontrados and _MEMORIA_SUELTA.search(nombre) and not _OTRA_COSA.search(nombre):
        return "ram"
    return None


def bloqueado_para_agrupar(nombre):
    return bool(_BLOQUEADOS.search(nombre))


def codigo_de_modelo(nombre, rubro):
    """El codigo normalizado (mayusculas) o None si no hay exactamente uno con la forma del rubro."""
    forma = _FORMAS.get(rubro)
    nombre = normalizar(nombre)
    if forma is None or bloqueado_para_agrupar(nombre):
        return None
    candidatos = set()
    for t in _TOKEN.findall(nombre):
        t = t.upper().rstrip(".")
        if _ESPECIFICACION.search(t):
            continue
        if forma.match(t):
            candidatos.add(t)
    return candidatos.pop() if len(candidatos) == 1 else None


def modelo_de(nombre, sku=None):
    """Lo que va a la columna `modelo` del indice: el codigo, o "" si el aviso queda suelto.
    Si el catalogo de la tienda publica el part number (`sku`), manda ese en cualquier rubro (monitores, notebooks,
    celulares...): es un dato del fabricante. Lo que se lee del titulo, solo en los rubros con forma de codigo conocida."""
    nombre = normalizar(nombre)
    if bloqueado_para_agrupar(nombre):
        return ""
    if sku:
        return sku
    rubro = rubro_de(nombre)
    return (codigo_de_modelo(nombre, rubro) if rubro else "") or ""


_SKU = re.compile(r"SKU:\s*([^'\",\]\[]+)", re.I)
_FORMA_SKU = re.compile(r"^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9][A-Z0-9/\-\.]{3,}[A-Z0-9]$")


def sku_de(valor):
    """El part number que publica un catalogo (CompraGamer: codigo_principal), o None si falta, hay
    varios distintos o no tiene forma de codigo. Es un dato del fabricante: no hace falta adivinarlo."""
    if isinstance(valor, (list, tuple)):
        valor = " ".join(str(v) for v in valor)
    if not isinstance(valor, str):
        return None
    candidatos = {c.strip().upper() for c in _SKU.findall(valor)}
    if len(candidatos) != 1:
        return None
    codigo = candidatos.pop()
    return codigo if _FORMA_SKU.match(codigo) else None


# Donde publica cada tienda el part number en la ficha del producto (no en el listado). El primer patron que da un
# codigo con forma valida manda: Mexx llama "P/N" al codigo del fabricante y "Modelo" a veces al nombre comercial.
_FICHAS = {
    "venex": (re.compile(r"<p>\s*MODELO:\s*([^<|]+?)\s*(?:\|[^<]*)?</p>", re.I),),
    "mexx": (re.compile(r"<b>\s*P/N\s*:\s*</b>\s*([^<]+?)\s*</p>", re.I),
             re.compile(r"<b>\s*Modelo\s*:\s*</b>\s*([^<]+?)\s*</p>", re.I)),
}


# Lo que un agregador a veces pone en "Modelo" y no es un part number: un chip, un chipset, una especificacion. Con eso como
# codigo, todas las RTX 4060 de todas las marcas serian "el mismo modelo".
_NO_ES_PART_NUMBER = re.compile(
    r"^(RTX|GTX|RX|ARC|GT)[-\s]?\d{3,4}|^[ABHQWXZ]\d{3}[A-Z]{0,2}$|^DDR\d|^LPDDR|^GDDR|^PCIE|^\d+(GB|TB|MHZ|HZ|W|MAH|MP)$|"
    r"^(I[3579]|CORE|RYZEN|ULTRA)[-\s]?\d|^M[1-9](PRO|MAX|ULTRA)?$|^A\d{2}(PRO|BIONIC)?$|^SNAPDRAGON|^DIMENSITY|^HELIO")


def modelo_de_api(valor):
    """El part number que un agregador publica en sus especificaciones (ComparaYa: `specifications.Modelo`), en
    mayusculas, o None si falta o no tiene forma de codigo (con espacios, solo letras o solo cifras: un nombre
    comercial, un numero de serie). Ante la duda no hay codigo."""
    if not isinstance(valor, str):
        return None
    codigo = html.unescape(valor).strip().upper().rstrip(".")
    return codigo if _FORMA_SKU.match(codigo) and not _NO_ES_PART_NUMBER.search(codigo) else None


def mpn_de_ficha(pagina, extractor):
    """El part number de la ficha de un producto (Venex: "MODELO: X | GTIN: ..."; Mexx: "P/N" o "Modelo"), en
    mayusculas, o None si la ficha no lo trae, trae dos distintos o no tiene forma de codigo (con espacios, solo
    letras, muy corto). Ante la duda no hay codigo: el aviso queda suelto, como siempre."""
    for patron in _FICHAS.get(extractor, ()):
        codigos = {html.unescape(c).strip().upper().rstrip(".") for c in patron.findall(pagina or "")}
        if len(codigos) > 1:
            return None
        validos = [c for c in codigos if _FORMA_SKU.match(c)]
        if validos:
            return validos[0]
    return None


# --- Firma: el mismo producto, publicado distinto en cada tienda --------------------------------------------------
#
# Sin part number en el titulo (y sin que la tienda lo publique), el mismo producto se reconoce por sus atributos
# normalizados: marca, chip o chipset, capacidad, linea y variantes (OC, WiFi, RGB, color, SODIMM...). Se ignoran el orden,
# las mayusculas, los guiones, las unidades pegadas o separadas (16GB, 16 Gb, 16G, 2Tb), los sinonimos del rubro (Mother,
# Motherboard, MB, Placa Madre) y las palabras de relleno (socket, formato, GDDR, CL, Box). Dos avisos son el mismo producto
# solo si la firma COMPLETA coincide: si falta un atributo clave o difiere uno solo, no hay firma o es otra. Nunca por parecido.

_COLORES = {"negro": "black", "negra": "black", "blanco": "white", "blanca": "white", "rojo": "red", "roja": "red",
            "azul": "blue", "plateado": "silver", "plata": "silver", "gris": "gray", "grey": "gray", "rosa": "pink"}
_RELLENO = {"de", "del", "la", "el", "para", "con", "sin", "y", "nuevo", "nueva", "new", "original", "oficial", "garantia",
            "box", "caja", "edition", "edicion", "version", "ver", "gaming", "series", "serie", "by", "pcs", "unidad"}
_RELLENO_POR_RUBRO = {
    "mb": {"motherboard", "mother", "mb", "placa", "madre", "base", "mainboard", "board", "socket", "ddr3", "ddr4", "ddr5"},
    "gpu": {"placa", "video", "vga", "tarjeta", "grafica", "graficos", "gpu", "geforce", "nvidia", "radeon", "amd", "graphics",
            "card", "gddr5", "gddr6", "gddr6x", "gddr7", "pcie", "pci", "e", "x16", "x8"},
    "ram": {"memoria", "memorias", "ram", "modulo", "pc", "desktop", "dimm", "udimm", "memory", "xmp", "expo", "kit", "latencia"},
    "ssd": {"disco", "ssd", "solido", "estado", "unidad", "hd", "drive", "interno", "pcie", "pci", "e", "x4", "x2", "m2", "gen3",
            "gen4", "gen5", "ssds", "internal"},
}
_MARCAS_MB = {"gigabyte", "asus", "msi", "asrock", "biostar", "evga", "colorful", "supermicro", "zotac"}
_MARCAS_GPU = {"asus", "msi", "gigabyte", "zotac", "palit", "pny", "galax", "sapphire", "powercolor", "xfx", "asrock", "colorful",
               "inno3d", "evga", "gainward", "afox", "maxsun", "sparkle", "biostar", "yeston", "pny", "intel"}
# Lineas que solo existen en una marca: si el titulo no nombra la marca, la linea la dice.
_LINEA_DE_MARCA = {"rog": "asus", "tuf": "asus", "prime": "asus", "proart": "asus", "aorus": "gigabyte", "windforce": "gigabyte",
                   "eagle": "gigabyte", "mag": "msi", "mpg": "msi", "meg": "msi", "ventus": "msi", "suprim": "msi",
                   "hellhound": "powercolor", "nitro": "sapphire", "pulse": "sapphire"}
# Lo que describe al producto pero no dice de quien es: con solo esto ("SSD 480GB Sata") dos genericos distintos tendrian la
# misma firma. Memoria y SSD necesitan ademas una marca o una linea.
_DESCRIPTORES = {"sata", "iii", "ii", "nvme", "sodimm", "udimm", "rgb", "argb", "black", "white", "red", "blue", "silver", "gray",
                 "pink", "notebook", "laptop", "ssd", "m2", "msata", "heatsink", "disipador", "low", "profile"}
_CHIPSET = re.compile(r"^[abhqwxz]\d{3}[a-z]{0,2}$")
_CHIP_GPU = re.compile(r"^(rtx|gtx|rx|arc)\d{3,4}(ti|tisuper|super|xt|xtx|gre)?$")


def _tokens(nombre):
    t = normalizar(nombre).lower()
    t = "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
    t = t.replace("&", " ").replace("\u2033", '"')
    t = re.sub(r"\bsin\s+[a-z0-9]+", " ", t)              # "sin RGB", "sin disipador": lo que NO tiene no es un atributo
    t = re.sub(r"\b[23]\.5\s?(?:\"|pulgadas|pulg)?", " ", t)             # formato del disco: no identifica
    t = re.sub(r"\b\d+\s?mb/s\b|\bpc[345]-?\d+\b|\b\d(?:\.\d+)?\s?v\b|\bcl\s?\d{2}\b", " ", t)   # velocidades, PC4-25600, 1.35V, CL16
    t = re.sub(r"(\d)\s*(gb|tb|mhz)\b", r"\1\2", t)
    t = re.sub(r"\b(\d{1,4})g\b", r"\1gb", t)                              # 16G -> 16GB
    t = re.sub(r"\bs\.?o[\s.-]?dimm\b|\b(?:notebook|laptop)\b(?=.*\bddr[2345]\b)", "sodimm", t)
    t = re.sub(r"\bu[\s-]?dimm\b", "udimm", t)
    t = re.sub(r"\b(?:m|micro)[\s-]?atx\b|\be[\s-]?atx\b|\bmini[\s-]?itx\b|\batx\b", " ", t)
    t = re.sub(r"\blga\s?\d{3,4}\b|\bam[45]\b", " ", t)
    t = re.sub(r"\b(rtx|gtx|rx|arc)\s*-?(\d{3,4})(?:\s*(ti\s*super|super|ti|xtx|xt|gre)\b)?",
               lambda m: m.group(1) + m.group(2) + (m.group(3) or "").replace(" ", ""), t)
    t = re.sub(r"\bm\.?\s?2\b", "m2", t)
    toks = []
    for x in re.findall(r"[a-z0-9]+", t):
        mt = re.fullmatch(r"(\d+)tb", x)
        toks.append(f"{int(mt.group(1)) * 1000}gb" if mt else _COLORES.get(x, x))
    return toks


def firma_de(nombre):
    """(rubro, firma) del aviso, o None si es usado/OEM/bulk, no es de un rubro con firma o le falta un atributo clave
    (marca, chipset o chip, capacidad, generacion de memoria). La firma es texto: se compara por igualdad exacta."""
    rubro = rubro_de(nombre)
    if rubro is None or bloqueado_para_agrupar(normalizar(nombre)):
        return None
    toks = _tokens(nombre)
    marca = next((t for t in toks if t in (_MARCAS_MB if rubro == "mb" else _MARCAS_GPU)), None)
    if marca is None:
        marca = next((_LINEA_DE_MARCA[t] for t in toks if t in _LINEA_DE_MARCA), None)
    relleno = _RELLENO | _RELLENO_POR_RUBRO[rubro]
    clave = [t for t in toks if t not in relleno]
    if rubro == "mb":
        if marca is None or not any(_CHIPSET.match(t) for t in clave):
            return None
    elif rubro == "gpu":
        chips = {t for t in clave if _CHIP_GPU.match(t)}
        vram = {t for t in clave if re.fullmatch(r"\d{1,2}gb", t) and int(t[:-2]) <= 48}
        if marca is None or len(chips) != 1 or len(vram) != 1:
            return None
    elif rubro == "ram":
        gen = {t for t in clave if re.fullmatch(r"ddr[2345]", t)}
        cap = {t for t in clave if re.fullmatch(r"\d{1,3}gb|\dx\d{1,3}gb", t)}
        resto = [t for t in clave if t not in gen and t not in cap and t not in _DESCRIPTORES and not re.fullmatch(r"\d+(mhz)?", t)]
        if len(gen) != 1 or not cap or not resto:
            return None
    elif rubro == "ssd":
        cap = {t for t in clave if re.fullmatch(r"\d{2,5}gb", t)}
        resto = [t for t in clave if t not in cap and t not in _DESCRIPTORES and not re.fullmatch(r"\d+", t)]
        if len(cap) != 1 or not resto:
            return None
    if marca and marca not in clave:
        clave.append(marca)                    # la linea nombrada sin la marca ("ROG STRIX") la deduce
    return rubro, rubro + "|" + " ".join(sorted(set(clave)))


def codigo_de_firma(firma):
    return "~" + hashlib.sha1(firma.encode("utf-8")).hexdigest()[:12].upper()


def _clase(nombre):
    """ram, ssd, gpu o mb; o, para el resto, la primera palabra del titulo (notebook, monitor, celular...)."""
    rubro = rubro_de(nombre)
    if rubro:
        return rubro
    palabras = re.findall(r"[a-z]+", unicodedata.normalize("NFD", normalizar(nombre).lower()))
    return palabras[0] if palabras else ""


def completar_con_conocidos(filas):
    """Completa la columna `modelo` de los avisos que no tienen codigo, en dos pasos:
    1. Si su nombre nombra EXACTO (un token entero) un codigo ya conocido de otro aviso, toma ese. Dos codigos conocidos
       en un nombre, o un nombre bloqueado o que no es del rubro, quedan sueltos.
    2. Si no, por su firma (ver `firma_de`): el mismo producto publicado distinto en cada tienda. Si algun aviso de la
       firma trae part number (uno solo), los demas lo heredan; si ninguno lo trae y hay dos o mas, comparten un
       identificador derivado (empieza con "~"). Dos part numbers distintos en una firma no se mezclan.
    Deja las filas como estaban si no hay nada que completar. Los "~" de una corrida anterior se recalculan."""
    for f in filas:
        if isinstance(f[9], str) and f[9].startswith("~"):
            f[9] = ""
    conocidos = {}
    for f in filas:
        if f[9]:
            conocidos.setdefault(f[9], set()).add(_clase(f[0]))
    if conocidos:
        for f in filas:
            if f[9] or bloqueado_para_agrupar(f[0]):
                continue
            # un codigo solo se le asigna a un aviso de la misma clase: la notebook que nombra el SSD que trae no es ese SSD
            halladas = {c for c in (t.upper().rstrip(".") for t in _TOKEN.findall(normalizar(f[0]))) if c in conocidos
                        and _clase(f[0]) in conocidos[c]}
            if len(halladas) == 1:
                f[9] = halladas.pop()
    por_firma = {}
    for f in filas:
        r = firma_de(f[0])
        if r:
            por_firma.setdefault(r[1], []).append(f)
    for firma, grupo in por_firma.items():
        sueltos = [f for f in grupo if not f[9]]
        if not sueltos:
            continue
        codigos = {f[9] for f in grupo if f[9]}
        if len(codigos) == 1:
            codigo = next(iter(codigos))
        elif not codigos and len(grupo) >= 2:
            codigo = codigo_de_firma(firma)
        else:
            continue
        for f in sueltos:
            f[9] = codigo
    return filas
