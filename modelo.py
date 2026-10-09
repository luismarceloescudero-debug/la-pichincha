#!/usr/bin/env python3
"""Codigo de modelo (part number) de un aviso, para agrupar el mismo producto entre tiendas.

Agrupar por nombre parecido ya se probo y fallo, asi que aca la regla es la contraria: un aviso tiene
codigo solo si el nombre trae uno con la forma de un part number de ese rubro; ante la duda no hay codigo
y el aviso queda suelto. Dos avisos son el mismo producto cuando el codigo coincide exacto.

Cada regla nueva entra con un nombre real en tests/test_modelo.py.
"""

import re

RUBROS = ("ram", "ssd", "gpu")

# Nombres que solo mencionan el componente: notebooks, motherboards, PCs armadas, discos mecanicos.
_NO_ES_COMPONENTE = re.compile(
    r"\b(notebook|laptop|mother|motherboard|pc gamer|all in one|aio|macbook|ipad|celular|smartphone)\b|rpm\b",
    re.I)

_RUBRO_POR_INICIO = (
    ("ram", re.compile(r"^\s*(memoria|memorias|ram|modulo)\b", re.I)),
    ("ssd", re.compile(r"^\s*(hd ssd|hd m\.?2|disco solido|disco s.lido|disco ssd|ssd)\b", re.I)),
    ("gpu", re.compile(r"^\s*(placa de v.{1,2}deo|tarjeta de v.{1,2}deo|vga)\b", re.I)),
)

# Marcas de usado o de venta sin garantia de fabrica: no son el mismo producto que el nuevo.
_BLOQUEADOS = re.compile(
    r"\b(usad[oa]s?|reacondicionad[oa]s?|refurbished|open ?box|outlet|bulk|oem)\b", re.I)

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


def rubro_de(nombre):
    """ram, ssd o gpu si el aviso ES ese componente (no una notebook que lo trae); si no, None."""
    if _NO_ES_COMPONENTE.search(nombre):
        return None
    encontrados = [r for r, rx in _RUBRO_POR_INICIO if rx.search(nombre)]
    return encontrados[0] if len(encontrados) == 1 else None


def bloqueado_para_agrupar(nombre):
    return bool(_BLOQUEADOS.search(nombre))


def codigo_de_modelo(nombre, rubro):
    """El codigo normalizado (mayusculas) o None si no hay exactamente uno con la forma del rubro."""
    forma = _FORMAS.get(rubro)
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


def modelo_de(nombre):
    """Lo que va a la columna `modelo` del indice: el codigo, o "" si el aviso queda suelto."""
    return codigo_de_modelo(nombre, rubro_de(nombre)) or ""
