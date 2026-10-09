import unittest

import modelo


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
            "MOTHER MSI PRO A620AM-G EVO WIFI DDR5 AM5",
            "PC Gamer AMD Ryzen 7 9800X3D RTX 5080 Y70 TOUCH CHERRY X870 32GB 1TB SSD NVMe WIFI Water Cooler",
            "Auriculares Redragon Zeus X H510W RGB Surround 7.1 White",
            "Disco Rigido WD 8TB Red Plus NAS 256MB SATA 5640RPM",
        ):
            self.assertIsNone(modelo.rubro_de(nombre), nombre)


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


if __name__ == "__main__":
    unittest.main()
