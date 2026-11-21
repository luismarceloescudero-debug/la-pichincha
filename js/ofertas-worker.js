/* Calcula las ofertas de todo el indice fuera del hilo principal (spec 054, busqueda en celular: calcularOfertas son ~1 s de
   CPU en una PC y varios segundos en un telefono, todo de corrido, y frenaba la pantalla).
   Baja el mismo indice.json (ya esta en la cache del navegador), lo calcula y devuelve el resultado por posicion
   (Ofertas.codificar). Si el indice no es el que tiene la pagina, avisa y la pagina lo calcula ella. */
"use strict";
/* importScripts puede fallar en dispositivos con red inestable (Sentry LA-PICHINCHA-4: Chrome Mobile iOS).
   Si falla, _ok queda false y cada mensaje devuelve {ok:false} para que la pagina haga enHilo(). */
let _ok = false;
try {
  importScripts("buscador.js", "categorias.js", "titulo.js", "ofertas.js");
  _ok = true;
} catch (_e) {}

self.onmessage = async e => {
  if (!_ok) return self.postMessage({ ok: false });
  try {
    const { url, generado, filas } = e.data;
    const idx = await (await fetch(url, { cache: "force-cache" })).json();
    if (idx.generado !== generado || idx.productos.length !== filas) return self.postMessage({ ok: false });
    self.postMessage({ ok: true, ofertas: self.Ofertas.codificar(self.Ofertas.calcularOfertas(idx), idx.productos) });
  } catch (err) {
    self.postMessage({ ok: false });
  }
};
