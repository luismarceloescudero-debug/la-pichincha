// Servidor estatico minimo para las pruebas e2e: sirve _sitio (o la carpeta del segundo argumento).
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const RAIZ = path.resolve(process.argv[3] || "_sitio");
const TIPOS = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".svg": "image/svg+xml", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon",
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let archivo = path.join(RAIZ, ruta);
  if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(archivo) && fs.statSync(archivo).isDirectory()) archivo = path.join(archivo, "index.html");
  fs.readFile(archivo, (err, datos) => {
    if (err) {                                    // como GitHub Pages: la 404 del sitio, si esta armada, en la misma URL
      fs.readFile(path.join(RAIZ, "404.html"), (e, html) => e
        ? res.writeHead(404, { "Content-Type": "text/plain" }).end("no existe")
        : res.writeHead(404, { "Content-Type": TIPOS[".html"] }).end(html));
      return;
    }
    res.writeHead(200, { "Content-Type": TIPOS[path.extname(archivo)] || "application/octet-stream" }).end(datos);
  });
}).listen(Number(process.argv[2]) || 8091);
