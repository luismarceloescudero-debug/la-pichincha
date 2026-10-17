import unittest
from pathlib import Path

import modelo

FIXTURES = Path(__file__).resolve().parent / "fixtures"


class RubroDe(unittest.TestCase):
    def test_memoria_ssd_y_placa_de_video(self):
        casos = {
            "Memoria Ddr4 16Gb 3200Mhz Kingston Fury Beast Kf432C16Bb1/16": "ram",
            "MEMORIA SODIMM 8GB DDR3 1600 HIKSEMI HIKER HSC308S16Z1": "ram",
            "Disco Ssd 480Gb Kingston Sedc600M/480G": "ssd",
            "HD SSD 512GB KINGSTON KC600 SATA III 2.5\" SKC600/512G": "ssd",
            "Disco Solido SSD M.2 WD 1TB Blue SN5100 7100MB/s NVMe PCI-E Gen4 x4": "ssd",
            "Placa de video Nvidia GIGABYTE RTX 5070 eagle oc 12GB gv-n5070eagleoc Ice-12gd": "gpu",
            "Tarjeta De Video - Asus Dual-rtx3060-o12g-v2 - 12 Gb Gddr6": "gpu",
            "Placa De V�deo Nvidia Gigabyte Geforce Rtx 5080 Windforce Oc 16g Gddr7": "gpu",
        }
        for nombre, rubro in casos.items():
            self.assertEqual(modelo.rubro_de(nombre), rubro, nombre)

    def test_lo_que_solo_menciona_el_componente_no_es_del_rubro(self):
        for nombre in (
            "Notebook Gamer HP Victus 15 15.6\" Intel Core i5 13420H 32GB DDR4 SSD 1TB RTX 4050 Win11 15-fa2013la",
            "PC Gamer AMD Ryzen 7 9800X3D RTX 5080 Y70 TOUCH CHERRY X870 32GB 1TB SSD NVMe WIFI Water Cooler",
            "Auriculares Redragon Zeus X H510W RGB Surround 7.1 White",
            "Disco Rigido WD 8TB Red Plus NAS 256MB SATA 5640RPM",
        ):
            self.assertIsNone(modelo.rubro_de(nombre), nombre)


class RubroPorComoSePublica(unittest.TestCase):
    """Cada tienda publica el mismo producto de otra forma: el rubro no puede depender de la palabra con la que empieza."""

    def test_placas_madre(self):
        for nombre in ("MOTHER MSI PRO A620AM-G EVO WIFI DDR5 AM5", "Motherboard GIGABYTE B840M H AM5 DDR5",
                       "Mother GIGABYTE B840M H DDR5 \u2013 AM5", "MB ASUS AM5 ROG STRIX X870E-E GAMING NEO DDR5 BOX",
                       "Placa Madre Asus Prime B650M-A", "Placa base MSI H410M-A PRO"):
            self.assertEqual(modelo.rubro_de(nombre), "mb", nombre)

    def test_la_memoria_que_empieza_por_otra_palabra_sigue_siendo_memoria(self):
        for nombre in ("SODIMM DDR5 8GB HIKSEMI 4800MHZ", "SODIMM DDR4 8GB KINGSTON 3200MHZ CL20 FURY IMPACT",
                       "Memoria RAM Notebook SODIMM Hiksemi Hiker DDR3 4GB 1600MHz",     # "notebook" es para que equipo es
                       "Hiksemi Hiker Ddr4 32Gb 3200Mhz U-Dimm", "Kingston Fury Beast DDR5 16GB 5600MHz",
                       "Memoria Ram Ddr4 32Gb 3200Mhz Patriot Udimm Pc"):
            self.assertEqual(modelo.rubro_de(nombre), "ram", nombre)

    def test_los_equipos_y_lotes_que_la_nombran_no_son_memoria(self):
        for nombre in ("Notebook Lenovo 16GB DDR5 512GB", "PC GAMER AMD ATHLON 3000G A520 8GB DDR4 480GB SSD",
                       "COMBO AMD 9600X B650 16GB DDR5 5600 COOLER DISIPADOR", "Procesador AMD Ryzen 5 7600 DDR5 AM5 16GB",
                       "Monitor Samsung 27 DDR4 8GB", "Pc Armada AMD Ryzen 7 5700G 16GB DDR4 512GB"):
            self.assertIsNone(modelo.rubro_de(nombre), nombre)


class Normalizar(unittest.TestCase):
    def test_guiones_espacios_y_entidades(self):
        self.assertEqual(modelo.normalizar("Mother  GIGABYTE\u00a0B840M H DDR5 \u2013 AM5"), "Mother GIGABYTE B840M H DDR5 - AM5")
        self.assertEqual(modelo.normalizar("Monitor 27&#8243; &amp; Co \u2014 240hz"), "Monitor 27\" & Co - 240hz")


class Bloqueados(unittest.TestCase):
    def test_usado_reacondicionado_bulk_y_oem_no_se_agrupan(self):
        for nombre in (
            "Placa De Video Gigabyte Aorus Elite Rtx4070 Ti 12gb Gddr6x (Reacondicionado)",
            "Disco Solido SSD Mancer 480GB Reaper SATA 530MB/s BULK",
            "Memoria Kingston 8Gb OEM KVR56U46BS6-8",
            "Disco SSD Kingston usado 480gb",
            "Memoria Corsair Refurbished CMK16GX4M2B3200C16",
            "Placa de video Open Box MSI",
        ):
            self.assertTrue(modelo.bloqueado_para_agrupar(nombre), nombre)

    def test_un_nombre_comun_no_esta_bloqueado(self):
        self.assertFalse(modelo.bloqueado_para_agrupar("Memoria Ddr4 16Gb 3200Mhz Kingston Fury Beast Kf432C16Bb1/16"))


class CodigoDeModelo(unittest.TestCase):
    def test_codigos_reales_por_rubro(self):
        casos = [
            ("ram", "Memoria Ddr4 16Gb 3200Mhz Kingston Fury Beast Kf432C16Bb1/16", "KF432C16BB1/16"),
            ("ram", "Memoria Ram Ddr5 32Gb 5600Mhz Rgb Kingston Fury Beast Kf556C36Bbea-32", "KF556C36BBEA-32"),
            ("ram", "Memoria Ddr5 8Gb 5600Mhz Kingston Cl46 Kvr56U46Bs6-8", "KVR56U46BS6-8"),
            ("ram", "MEMORIA 8GB DDR5 5600 KINGSTON NO-ECC KCP556US6-8", "KCP556US6-8"),
            ("ram", "MEMORIA SODIMM 8GB DDR3 1600 HIKSEMI HIKER HSC308S16Z1", "HSC308S16Z1"),
            ("ssd", "Disco Ssd 480Gb Kingston Sedc600M/480G", "SEDC600M/480G"),
            ("ssd", "HD SSD 512GB KINGSTON KC600 SATA III 2.5\" SKC600/512G", "SKC600/512G"),
            ("gpu", "Placa de video Intel Gigabyte Eagle RTX 5060 Ti GV-N506TEAGLE OC-16GD OC Edition 16GB", "GV-N506TEAGLE"),
            ("gpu", "Placa De Video Radeon R5 230 2GB DDR3 LOW PROFILE AKR230D3S2GL1", None),
            ("gpu", "Tarjeta De Video - Asus Dual-rtx3060-o12g-v2 - 12 Gb Gddr6", "DUAL-RTX3060-O12G-V2"),
            ("gpu", "Placa de video Nvidia Evga Ftw Ultra Gaming GeForce Rtx 30 Series Rtx 3090 24g-p5-3987-kr", "24G-P5-3987-KR"),
            ("gpu", "Placa de video Nvidia MSI Ventus 2X GeForce RTX 40 Series RTX 4060 Ti 912-V515-024 OC Edition", "912-V515-024"),
        ]
        for rubro, nombre, esperado in casos:
            self.assertEqual(modelo.codigo_de_modelo(nombre, rubro), esperado, nombre)

    def test_una_especificacion_no_es_un_codigo(self):
        for rubro, nombre in (
            ("ram", "Memoria Adata DDR4 16GB 3200MHz SODIMM Premier"),
            ("ram", "Memoria KLEVV DDR5 32GB (2x16GB) 6000MHz FIT V White CL30 IC Hynix"),
            ("ram", "Memoria Patriot DDR5 32GB (2x16GB) 6400MHz Viper Venom CL32 XMP 3.0/AMD EXPO"),
            ("ssd", "HD SSD 1TB WD BLACK SN8100 M.2 NVME GEN5 14900MB/S 2280"),
            ("ssd", "Disco Solido SSD Mancer 480GB Reaper SATA 530MB/s"),
            ("gpu", "Placa de Video ASUS PRIME GeForce RTX 5070 Ti 16GB GDDR7 OC"),
            ("gpu", "Placa de Video MSI RTX 5060 Ventus 2X 8GB"),
        ):
            self.assertIsNone(modelo.codigo_de_modelo(nombre, rubro), nombre)

    def test_dos_codigos_distintos_o_un_nombre_bloqueado_dejan_el_aviso_suelto(self):
        self.assertIsNone(modelo.codigo_de_modelo("Memoria Kingston KF432C16BB/16 KF432C16BB1/16 16GB", "ram"))
        self.assertIsNone(modelo.codigo_de_modelo("Disco Ssd 480Gb Kingston Sedc600M/480G BULK", "ssd"))

    def test_el_mismo_codigo_escrito_distinto_da_la_misma_clave(self):
        a = modelo.codigo_de_modelo("Memoria 16Gb Kingston Fury kf432c16bb1/16", "ram")
        b = modelo.codigo_de_modelo("MEMORIA 16GB KINGSTON FURY  KF432C16BB1/16 ", "ram")
        self.assertEqual(a, b)

    def test_codigos_parecidos_no_son_el_mismo(self):
        a = modelo.codigo_de_modelo("Memoria Kingston KF432C16BB/16", "ram")
        b = modelo.codigo_de_modelo("Memoria Kingston KF432C16BB1/16", "ram")
        self.assertNotEqual(a, b)
        self.assertIsNotNone(a)

    def test_sin_rubro_o_rubro_desconocido_no_hay_codigo(self):
        self.assertIsNone(modelo.codigo_de_modelo("Memoria Kingston KF432C16BB/16", None))
        self.assertIsNone(modelo.codigo_de_modelo("Auricular XYZ-1234ABC", "audio"))

    def test_para_un_aviso_devuelve_rubro_y_codigo(self):
        self.assertEqual(modelo.modelo_de("Disco Ssd 480Gb Kingston Sedc600M/480G"), "SEDC600M/480G")
        self.assertEqual(modelo.modelo_de("Notebook HP 15-fd0153wm 16GB DDR4 SSD 512GB"), "")
        self.assertEqual(modelo.modelo_de("Disco Ssd 480Gb Kingston Sedc600M/480G BULK"), "")


class SkuDelCatalogo(unittest.TestCase):
    """CompraGamer publica el part number en su catalogo: es un dato del fabricante, no una adivinanza."""

    def test_un_unico_sku_es_el_codigo(self):
        self.assertEqual(modelo.sku_de(["SKU: SA400S37/480G"]), "SA400S37/480G")
        self.assertEqual(modelo.sku_de("['SKU: sa400s37/480g']"), "SA400S37/480G")

    def test_sin_sku_o_con_varios_o_dudoso_no_hay_codigo(self):
        for valor in (None, [], "", "None", ["SKU: AAA111", "SKU: BBB222"], ["SKU: N/A"], ["SKU: 123"],
                      ["SKU: con espacios 12"], ["EAN: 7412345678901"], 42):
            self.assertIsNone(modelo.sku_de(valor), valor)

    def fila(self, nombre, modelo_="", tienda="uno"):
        return [nombre, 1000, "https://x.test/" + nombre, tienda, "", 0, 0, "", "", modelo_]

    def test_el_codigo_conocido_se_asigna_a_otro_aviso_que_lo_nombra_exacto(self):
        filas = [self.fila("Disco Solido SSD Kingston 480GB A400 SATA 500MB/s", "SA400S37/480G", "cg"),
                 self.fila("HD SSD 480GB KINGSTON A400 SATA III 2.5\" SA400S37/480G", "", "fh"),
                 self.fila("HD SSD 480GB KINGSTON A400 SATA III 2.5\" SA400S37/480", "", "mx")]
        modelo.completar_con_conocidos(filas)
        self.assertEqual([f[9] for f in filas], ["SA400S37/480G", "SA400S37/480G", ""])

    def test_dos_codigos_conocidos_en_un_nombre_o_un_nombre_bloqueado_quedan_sueltos(self):
        filas = [self.fila("Disco Ssd Kingston AAA111X", "AAA111X", "cg"), self.fila("Disco Ssd Kingston BBB222X", "BBB222X", "gc"),
                 self.fila("Disco Ssd Kingston AAA111X BBB222X", "", "fh"),
                 self.fila("Disco Ssd Kingston AAA111X BULK", "", "mx"),
                 self.fila("Notebook con SSD Kingston AAA111X", "", "pc")]
        modelo.completar_con_conocidos(filas)
        self.assertEqual([f[9] for f in filas], ["AAA111X", "BBB222X", "", "", ""])

    def test_no_cambia_lo_que_ya_tiene_codigo_ni_depende_del_orden(self):
        a = self.fila("Disco Ssd Kingston AAA111X", "AAA111X", "cg")
        b = self.fila("HD SSD KINGSTON AAA111X", "", "fh")
        uno, dos = [a[:], b[:]], [b[:], a[:]]
        modelo.completar_con_conocidos(uno)
        modelo.completar_con_conocidos(dos)
        self.assertEqual(sorted(f[9] for f in uno), sorted(f[9] for f in dos))


class Firma(unittest.TestCase):
    """Sin part number en el titulo, el mismo producto se reconoce por sus atributos normalizados (marca, chip o chipset,
    capacidad, linea y variantes), sin importar el orden, las mayusculas, los guiones ni las palabras de relleno. Si falta
    un atributo o difiere uno solo, son productos distintos."""

    def firma(self, nombre):
        r = modelo.firma_de(nombre)
        return r[1] if r else None

    def mismos(self, *nombres):
        firmas = {self.firma(n) for n in nombres}
        self.assertNotIn(None, firmas, nombres)
        self.assertEqual(len(firmas), 1, nombres)

    def distintos(self, a, b):
        fa, fb = self.firma(a), self.firma(b)
        self.assertNotEqual(fa, fb, (a, b))

    def test_placa_madre_publicada_de_tres_maneras(self):
        self.mismos("Motherboard GIGABYTE B840M H AM5 DDR5", "Mother GIGABYTE B840M H DDR5 \u2013 AM5",
                    "Motherboard Gigabyte B840M H AM5 DDR5 mATX", "MB GIGABYTE B840M-H AM5 DDR5 Micro ATX BOX")

    def test_placa_madre_orden_distinto_y_guion(self):
        self.mismos("MOTHER MSI H410M-A PRO DDR4 LGA1200", "Placa Madre MSI PRO H410M A LGA 1200 DDR4")
        self.mismos("MB ASUS AM5 ROG STRIX X870E-E GAMING NEO DDR5 BOX", "Motherboard Asus ROG Strix X870E-E Gaming Neo AM5")

    def test_placas_madre_parecidas_no_se_confunden(self):
        self.distintos("MB ASUS AM5 ROG STRIX X870E-E GAMING NEO DDR5 BOX", "MB ASUS AM5 ROG STRIX X870E-A GAMING NEO DDR5 BOX")
        self.distintos("Motherboard GIGABYTE B840M H AM5 DDR5", "Motherboard GIGABYTE B840M GAMING X AM5 DDR5")
        self.distintos("MOTHER ASROCK X870 CHALLENGER WIFI WHITE DDR5", "MOTHER ASROCK X870 CHALLENGER DDR5")
        self.distintos("Motherboard GIGABYTE B840M H AM5 DDR5", "Motherboard ASUS B840M H AM5 DDR5")

    def test_placa_de_video_con_otro_nombre_y_otro_orden(self):
        self.mismos("Placa De Video Msi Geforce Rtx 5070 TI 16G Ventus 3X Oc",
                    "VGA MSI GeForce RTX 5070 Ti 16GB GDDR7 VENTUS 3X OC", "Placa de video MSI RTX5070TI 16 GB Ventus 3X OC Edition")
        self.mismos("Placa de Video MSI GeForce RTX 3060 Ventus 2X 12GB", "Placa de Video MSI GeForce RTX 3060 12GB VENTUS 2X")

    def test_placa_de_video_variantes_distintas(self):
        base = "Placa De Video Msi Geforce Rtx 5070 TI 16G Ventus 3X Oc"
        self.distintos(base, "Placa De Video Msi Geforce Rtx 5070 TI 16G Ventus 3X")                 # sin OC
        self.distintos(base, "Placa De Video Msi Geforce Rtx 5070 16G Ventus 3X Oc")                 # no es Ti
        self.distintos(base, "Placa De Video Asus Geforce Rtx 5070 TI 16G Ventus 3X Oc")             # otra marca
        self.distintos("Placa de Video MSI GeForce RTX 3060 Ventus 2X 12GB", "Placa de Video MSI GeForce RTX 3060 Ventus 2X 8GB")

    def test_ssd_con_distinta_tipografia(self):
        self.mismos("Disco SSD M.2 SANDISK 2TB Plus NVMe Gen3", "Disco Solido Sandisk Ssd Plus Nvme 2Tb",
                    "SSD SanDisk Plus 2 TB NVMe M.2")
        self.mismos("Disco SSD Lexar 500GB NF100 SATA", "SSD LEXAR NF100 500 Gb Sata 2.5\"")

    def test_ssd_distinto(self):
        self.distintos("Disco SSD Sandisk Plus 1TB Sata", "Disco SSD Sandisk Plus 1TB NVMe")
        self.distintos("Disco SSD Lexar 500GB NF100 SATA", "Disco SSD Lexar 250GB NF100 SATA")
        self.distintos("Disco SSD Sandisk 1TB Plus Nvme", "Disco SSD Sandisk 2TB Plus Nvme")

    def test_memoria_con_distinta_tipografia(self):
        self.mismos("Memoria RAM Kingston DDR4 16GB 3200MHz CL22", "Memoria Ram Kingston Ddr4 16Gb 3200Mhz Cl22",
                    "Memoria Ddr4 16Gb 3200Mhz Kingston", "Kingston DDR4 - 16Gb 3200 Mhz")
        self.mismos("Hiksemi Hiker Ddr4 32Gb 3200Mhz U-Dimm", "Memoria Hiksemi Hiker DDR4 32GB 3200MHz UDIMM", "Memoria Hiksemi Hiker DDR4 32GB 3200MHz")

    def test_memoria_distinta(self):
        self.distintos("Memoria RAM Notebook SODIMM Hiksemi Hiker DDR4 8GB 3200MHz", "Memoria Hiksemi Hiker DDR4 8GB 3200MHz")
        self.distintos("SODIMM DDR4 8GB HIKSEMI 3200MHZ", "SODIMM DDR5 8GB HIKSEMI 4800MHZ")
        self.distintos("Memoria Kingston DDR4 16GB 3200MHz", "Memoria Kingston DDR4 16GB 3600MHz")
        self.distintos("Memoria Kingston DDR4 16GB 3200MHz", "Memoria Kingston DDR4 32GB 3200MHz")
        self.distintos("Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX Black", "Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX White")
        self.mismos("Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX Black", "Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX Negro")
        self.distintos("Memoria Kingston Fury Beast DDR5 32GB 6000MHz", "Memoria Kingston Fury Beast RGB DDR5 32GB 6000MHz")

    def test_sin_atributos_suficientes_no_hay_firma(self):
        for nombre in ("Mother GIGABYTE DDR5 AM5", "Motherboard B840M H AM5", "Placa de video RTX 5070 Ti 16GB",
                       "Placa de video Msi Ventus 3X Oc", "Memoria RAM DDR4", "Disco SSD Sandisk Plus",
                       "Disco SSD Sandisk Plus 2TB Nvme Usado", "Memoria Kingston 8Gb OEM DDR4", "Mouse Logitech G502"):
            self.assertIsNone(modelo.firma_de(nombre), nombre)

    def fila(self, nombre, modelo_="", tienda="uno"):
        return [nombre, 1000, "https://x.test/" + nombre, tienda, "", 0, 0, "", "", modelo_]

    def test_el_mismo_producto_sin_codigo_recibe_el_mismo_identificador(self):
        filas = [self.fila("Motherboard GIGABYTE B840M H AM5 DDR5", "", "mt"), self.fila("Mother GIGABYTE B840M H DDR5 \u2013 AM5", "", "scp"),
                 self.fila("Motherboard Gigabyte B840M H AM5 DDR5 mATX", "", "cg"), self.fila("Motherboard GIGABYTE B840M GAMING X AM5 DDR5", "", "mx")]
        modelo.completar_con_conocidos(filas)
        codigos = [f[9] for f in filas]
        self.assertTrue(codigos[0] and codigos[0] == codigos[1] == codigos[2])
        self.assertNotEqual(codigos[0], codigos[3])
        self.assertEqual(codigos[3], "")                         # uno solo: no hay con quien agruparlo

    def test_si_alguien_publica_el_part_number_los_demas_lo_heredan(self):
        filas = [self.fila("Placa de Video MSI GeForce RTX 3060 Ventus 2X 12GB", "912-V397-299", "cg"),
                 self.fila("Placa de Video MSI GeForce RTX 3060 12GB VENTUS 2X", "", "mt"),
                 self.fila("Placa de Video MSI GeForce RTX 3060 Ventus 2X 8GB", "", "scp")]
        modelo.completar_con_conocidos(filas)
        self.assertEqual([f[9] for f in filas], ["912-V397-299", "912-V397-299", ""])

    def test_dos_part_numbers_distintos_con_la_misma_firma_no_se_mezclan(self):
        filas = [self.fila("Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX", "CMK16GX4M1D3200C16", "cg"),
                 self.fila("Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX", "CMK16GX4M1E3200C16", "mx"),
                 self.fila("Memoria Corsair DDR4 16GB 3200MHz Vengeance LPX", "", "fh")]
        modelo.completar_con_conocidos(filas)
        self.assertEqual([f[9] for f in filas], ["CMK16GX4M1D3200C16", "CMK16GX4M1E3200C16", ""])

    def test_no_depende_del_orden(self):
        a = [self.fila("Motherboard GIGABYTE B840M H AM5 DDR5", "", "mt"), self.fila("Mother GIGABYTE B840M-H DDR5", "", "scp")]
        b = [a[1][:], a[0][:]]
        modelo.completar_con_conocidos(a)
        modelo.completar_con_conocidos(b)
        self.assertEqual({f[9] for f in a}, {f[9] for f in b})


class MpnDeFicha(unittest.TestCase):
    """El part number que publica la ficha de Venex y de Mexx (B3-bis): HTML real guardado, sin red."""

    def ficha(self, ruta):
        return (FIXTURES / ruta).read_text(encoding="utf-8")

    def test_venex_lee_el_modelo_y_corta_el_gtin(self):
        self.assertEqual(modelo.mpn_de_ficha(self.ficha("venex/ficha.html"), "venex"), "SA400S37/480G")

    def test_mexx_lee_el_pn_de_un_ssd(self):
        self.assertEqual(modelo.mpn_de_ficha(self.ficha("mexx/ficha-pn.html"), "mexx"), "SA400S37/240G")

    def test_mexx_sin_pn_usa_el_modelo(self):
        self.assertEqual(modelo.mpn_de_ficha(self.ficha("mexx/producto.html"), "mexx"), "HSC416U32Z2-16G")

    def test_mexx_prefiere_el_pn_al_modelo(self):
        html = "<b>Modelo : </b> NOMBRE123 </p> <b>P/N : </b> SA400S37/240G </p>"
        self.assertEqual(modelo.mpn_de_ficha(html, "mexx"), "SA400S37/240G")

    def test_mexx_si_el_pn_no_sirve_prueba_con_el_modelo(self):
        html = "<b>P/N : </b> N/A </p> <b>Modelo : </b> XMD4U-8G3200 </p>"
        self.assertEqual(modelo.mpn_de_ficha(html, "mexx"), "XMD4U-8G3200")

    def test_se_normaliza_a_mayusculas_y_sin_punto_final(self):
        self.assertEqual(modelo.mpn_de_ficha("<p>MODELO: sa400s37/480g.</p>", "venex"), "SA400S37/480G")

    def test_lo_que_no_tiene_forma_de_codigo_queda_afuera(self):
        for valor in ("HS-SSD-WAVE(P) 1024G", "WD Green SN350 NVMe SSD 1TB , TLC", "N/A", "KINGSTON", "123456", "A1"):
            self.assertIsNone(modelo.mpn_de_ficha(f"<p>MODELO: {valor} | GTIN: 1</p>", "venex"), valor)
            self.assertIsNone(modelo.mpn_de_ficha(f"<b>Modelo : </b> {valor} </p>", "mexx"), valor)

    def test_dos_codigos_distintos_en_la_ficha_no_se_eligen(self):
        self.assertIsNone(modelo.mpn_de_ficha("<p>MODELO: AAA111X</p><p>MODELO: BBB222X</p>", "venex"))

    def test_sin_el_campo_o_con_un_extractor_desconocido(self):
        self.assertIsNone(modelo.mpn_de_ficha("<html>sin nada</html>", "venex"))
        self.assertIsNone(modelo.mpn_de_ficha(self.ficha("venex/ficha.html"), "otra"))
        self.assertIsNone(modelo.mpn_de_ficha("", "mexx"))

    def test_entidades_html_y_espacios(self):
        self.assertEqual(modelo.mpn_de_ficha("<p>MODELO:   CMK16GX4M1E3200C16&nbsp;</p>", "venex"), "CMK16GX4M1E3200C16")


if __name__ == "__main__":
    unittest.main()


class ModeloDeCualquierRubro(unittest.TestCase):
    def test_el_part_number_de_un_catalogo_vale_en_monitores_notebooks_y_celulares(self):
        self.assertEqual(modelo.modelo_de("Monitor Samsung Odyssey G3 27", "LS27DG300ELXZB"), "LS27DG300ELXZB")
        self.assertEqual(modelo.modelo_de("Notebook Lenovo IdeaPad 15", "83DR00B3AR"), "83DR00B3AR")
        self.assertEqual(modelo.modelo_de("Monitor Samsung OEM", "LS27DG300ELXZB"), "")          # bloqueado
        self.assertEqual(modelo.modelo_de("Mouse Logitech G203"), "")                            # sin codigo ni forma conocida

    def test_el_part_number_de_un_agregador_se_valida(self):
        self.assertEqual(modelo.modelo_de_api("6N4E8AA"), "6N4E8AA")
        self.assertEqual(modelo.modelo_de_api(" ls27dg300elxzb "), "LS27DG300ELXZB")
        for v in (None, "", "Odyssey G3", "123456", "ABCDEF", 42):
            self.assertIsNone(modelo.modelo_de_api(v), v)

    def fila(self, nombre, modelo_="", tienda="uno"):
        return [nombre, 1000, "https://x.test/" + nombre, tienda, "", 0, 0, "", "", modelo_]

    def test_un_monitor_toma_el_codigo_de_otro_monitor_pero_no_de_otra_clase(self):
        filas = [self.fila("Monitor Gaming Odyssey Samsung G3 27 G30D FHD 180Hz", "LS27DG300ELXZB", "cy"),
                 self.fila("Monitor Samsung 27 LS27DG300ELXZB FHD", "", "mx"),
                 self.fila("Soporte para monitor LS27DG300ELXZB", "", "fh")]
        modelo.completar_con_conocidos(filas)
        self.assertEqual([f[9] for f in filas], ["LS27DG300ELXZB", "LS27DG300ELXZB", ""])


class CodigoInternoDeLaTienda(unittest.TestCase):
    def test_el_numero_entre_parentesis_al_final_no_es_parte_del_nombre(self):
        self.assertEqual(modelo.normalizar("Monitor Gamer MSI 24 MAG 245F (II) (3242)"), "Monitor Gamer MSI 24 MAG 245F (II)")
        self.assertEqual(modelo.normalizar("RE305 Range Extender TP Link AC1200 (7933)"), "RE305 Range Extender TP Link AC1200")
        self.assertEqual(modelo.normalizar("Memoria 16GB (2 x 8GB)"), "Memoria 16GB (2 x 8GB)")             # un parentesis con texto se queda

    def test_la_misma_placa_con_y_sin_el_codigo_interno_tiene_la_misma_firma(self):
        a = modelo.firma_de("Placa De Video Msi Geforce Rtx 5070 TI 16G Ventus 3X Oc (4455)")
        b = modelo.firma_de("Placa De Video Msi Geforce Rtx 5070 TI 16G Ventus 3X Oc")
        self.assertEqual(a, b)


class BloqueadosComoEnElBuscador(unittest.TestCase):
    """Python y JS tienen que coincidir en que es usado: si no, un aviso "caja abierta" se agrupa con lo nuevo."""

    def test_caja_abierta_exhibicion_y_seminuevo_no_se_agrupan(self):
        for nombre in ("Placa de Video MSI RTX 4060 8GB (Caja Abierta)", "Disco SSD Kingston 480GB Exhibición", "Memoria Kingston DDR4 16GB Seminuevo",
                       "Memoria Kingston DDR4 16GB semi nuevo", "Disco SSD WD 1TB segunda mano", "SSD Kingston 480GB open box", "SSD Kingston 480GB Refurb"):
            self.assertTrue(modelo.bloqueado_para_agrupar(nombre), nombre)
            self.assertIsNone(modelo.firma_de(nombre), nombre)
