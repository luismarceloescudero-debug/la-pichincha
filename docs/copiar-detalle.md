# Boton de un clic para copiar el detalle de un carrito

**Para que sirve.** Cargar un carrito hoy es: abrir el carrito, seleccionar el detalle, copiarlo, abrir la pagina «Carritos de Tiendamia» y pegarlo. Este boton hace los primeros pasos con un clic. **No recorre la tienda ni arma carritos**: lo corres vos, en tu navegador y con tu sesion, sobre el carrito que ya estas mirando, y solo copia al portapapeles el texto que ya esta en pantalla. Por eso no se salta el `robots.txt` de Tiendamia, que prohibe robots, no a una persona que copia lo suyo.

Sirve para Tiendamia, Amazon, eBay y Loquieroaca: el lector de `js/importar.js` entiende rotulo + monto y tolera texto de mas.

## Instalarlo (una vez)

1. Mostra la barra de marcadores del navegador (Ctrl+Shift+B).
2. Crea un marcador nuevo con el nombre `Copiar carrito`.
3. En la direccion (URL) pega **todo** el bloque de abajo, que empieza con `javascript:`.

```
javascript:(function%20(raiz)%20{%20const%20TOTAL%20=%20/total/i;%20const%20MONTO%20=%20/(us\s?\$|u\$s|usd|ar\$|ars|eur|%E2%82%AC|\$)\s*\d/i;%20const%20CLAVES%20=%20/detalle%20de%20la%20compra|resumen%20(de%20la%20compra|del%20pedido|de%20tu%20pedido)|order%20summary|resumen/i;%20function%20elegir(textos)%20{%20const%20buenos%20=%20textos%20.map(t%20=>%20String(t%20||%20"").replace(/\n{3,}/g,%20"\n\n").trim())%20.filter(t%20=>%20t.length%20>=%2040%20&&%20t.length%20<=%204000%20&&%20TOTAL.test(t)%20&&%20MONTO.test(t));%20if%20(!buenos.length)%20return%20"";%20buenos.sort((a,%20b)%20=>%20(CLAVES.test(b)%20-%20CLAVES.test(a))%20||%20a.length%20-%20b.length);%20return%20buenos[0];%20}%20async%20function%20copiar(texto,%20win)%20{%20try%20{%20await%20win.navigator.clipboard.writeText(texto);%20return%20true;%20}%20catch%20(e)%20{%20}%20try%20{%20const%20d%20=%20win.document,%20ta%20=%20d.createElement("textarea");%20ta.value%20=%20texto;%20ta.style.cssText%20=%20"position:fixed;opacity:0";%20d.body.appendChild(ta);%20ta.select();%20const%20ok%20=%20d.execCommand("copy");%20ta.remove();%20return%20ok;%20}%20catch%20(e)%20{%20return%20false;%20}%20}%20function%20aviso(win,%20mensaje,%20bien)%20{%20const%20d%20=%20win.document,%20el%20=%20d.createElement("div");%20el.textContent%20=%20mensaje;%20el.style.cssText%20=%20"position:fixed;z-index:2147483647;left:50%25;top:16px;transform:translateX(-50%25);max-width:90vw;padding:10px%2016px;"%20+%20"border-radius:8px;font:600%2014px%20system-ui,sans-serif;color:%23fff;background:"%20+%20(bien%20?%20"%231f6f4a"%20:%20"%23a33")%20+%20";box-shadow:0%202px%2012px%20%230006";%20d.body.appendChild(el);%20win.setTimeout(()%20=>%20el.remove(),%204000);%20}%20async%20function%20correr(win)%20{%20const%20sel%20=%20String(win.getSelection%20?%20win.getSelection()%20:%20"").trim();%20const%20d%20=%20win.document;%20const%20texto%20=%20sel.length%20>=%2020%20?%20sel%20:%20elegir(Array.from(d.querySelectorAll("div,section,aside,table,form,ul")).map(e%20=>%20e.innerText));%20if%20(!texto)%20return%20aviso(win,%20"No%20encontre%20el%20detalle%20de%20la%20compra%20en%20esta%20pagina.%20Selecciona%20el%20texto%20a%20mano%20y%20toca%20el%20boton%20otra%20vez.",%20false);%20const%20ok%20=%20await%20copiar(texto,%20win);%20aviso(win,%20ok%20?%20"Copiado%20("%20+%20texto.length%20+%20"%20caracteres).%20Pegalo%20en%20la%20pagina%20de%20Carritos."%20:%20"No%20pude%20copiar.%20Selecciona%20el%20texto%20y%20usa%20Ctrl+C.",%20ok);%20}%20if%20(typeof%20module%20!==%20"undefined"%20&&%20module.exports)%20module.exports%20=%20{%20elegir%20};%20else%20correr(raiz);%20})(typeof%20window%20!==%20"undefined"%20?%20window%20:%20this);
```

## Usarlo

1. Abri el carrito de la tienda con el detalle de la compra a la vista.
2. Toca el marcador `Copiar carrito`. Arriba aparece un cartel verde: «Copiado (N caracteres)».
3. Anda a la pagina «Carritos de Tiendamia» (o al campo de «Buscalo afuera») y pega con Ctrl+V.

Si el cartel dice que no encontro el detalle, selecciona el texto a mano y toca el marcador otra vez: copia lo seleccionado. Si el navegador no deja correr marcadores en esa pagina (algunos sitios lo bloquean con su politica de seguridad), usa Ctrl+C como siempre: no se pierde nada.

## Como esta hecho

- Codigo legible: `herramientas/copiar-detalle.js` (el marcador es esa misma funcion en una linea).
- Elige, entre los bloques de la pagina, el que tiene un total y un monto, no es enorme y dice «detalle» o «resumen»; si hay varios, el mas corto.
- Prueba: `tests/js/copiar-detalle.test.js`. Se probo ademas en un navegador real contra una pagina de carrito de mentira: copio solo el detalle, y `parsearDetalleTiendamia` lo leyo igual que el carrito real del AeroClip 2.
- **No se probo contra las tiendas reales** (no se leen sus carritos): la primera vez que lo uses en una, fijate que el texto pegado traiga productos, envio, servicios y total.
