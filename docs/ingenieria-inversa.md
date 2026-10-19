# Ingenieria inversa de web apps: herramientas y reglas

Para entender como una tienda arma sus precios y su stock (que API llama la pagina, que consultas hace, que datos trae) sin esquivar nada. Relevado e instalado el 19/10/2026. Complementa `docs/referencias.md`.

## Reglas (no se negocian)

1. **Analisis pasivo de lo publico.** Se estudia lo que la tienda sirve a cualquier visitante: sus archivos JavaScript, las llamadas de red que hace su pagina abierta en un navegador comun y sus APIs publicas documentadas. Asi se encontro la API de catalogo de VTEX y la consulta `getProductDetails_Shopping` de Frávega.
2. **Escaneo activo solo sobre sitios propios.** OWASP ZAP en modo ataque, fuzzing o fuerza bruta se usa unicamente sobre `pichinchadeldia.com.ar`. Contra una tienda ajena eso es atacarla.
3. **Nada que esquive un control antibot**: ni proxies, ni cambiar de IP o de identidad, ni resolver captchas o desafios. Si una tienda bloquea a los servidores de GitHub (Frávega, FullH4rd), la salida es pedirle un feed o una afiliacion (`privado/mails-tiendas.md`), no abrirla "disfrazados".
4. Lo que se descubre se verifica con una prueba real desde GitHub Actions antes de usarlo (`diagnostico.yml`); lo que no responde ahi queda afuera y se anota.

## Herramientas

| Capa | Herramienta | Estrellas | Licencia | Instalada | Para que |
|---|---|---:|---|---|---|
| Analisis estatico de JS | [webcrack](https://github.com/j4k0xb/webcrack) 2.16.0 | 2.966 | MIT | si (npm, carpeta de herramientas) | Desofuscar (obfuscator.io), desminificar y desempacar bundles de webpack |
| Analisis estatico de JS | [Wakaru](https://github.com/pionxzh/wakaru) 1.14.0 | 1.031 | Apache-2.0 | si (npm `@wakaru/cli`) | Descompilar y desempacar bundles; extrae fuentes de un source map |
| Interceptacion | [mitmproxy](https://github.com/mitmproxy/mitmproxy) 12.2.3 | 45.742 | MIT | si (`pip --user`) | Ver y guardar el trafico HTTP(S), con scripts. Para HTTPS hay que instalar su certificado en el sistema: lo decide el dueño |
| Interceptacion | [HTTP Toolkit](https://github.com/httptoolkit/httptoolkit-server) | 568 | AGPL-3.0 | winget `HTTPToolKit.HTTPToolKit` | Lo mismo con interfaz y enganche de un clic a Chrome, Android o Docker |
| Seguridad / orquestador | [OWASP ZAP](https://github.com/zaproxy/zaproxy) 2.17.0 | 15.968 | Apache-2.0 | si (winget `ZAP.ZAP`) | Proxy, escaner pasivo, araña y escaneos automatizados con API. Escaneo activo solo sobre el sitio propio |
| Automatizacion con IA (opcional) | [Chrome DevTools MCP](https://github.com/ChromeDevTools/chrome-devtools-mcp) 1.11.0 | 53.837 | Apache-2.0 | si, alcance local de este proyecto | El agente abre una pagina, lee la red, la consola y el rendimiento de Chrome |
| Automatizacion con IA (opcional) | [Playwright MCP](https://github.com/microsoft/playwright-mcp) 0.0.83 | 38.365 | Apache-2.0 | si, alcance local de este proyecto | El agente maneja un navegador con el arbol de accesibilidad |

Los dos MCP se agregaron con `claude mcp add --scope local ... --isolated` (no se suben al repo, perfil aislado sin tus sesiones). Sus herramientas aparecen en una sesion nueva. No hay MCP maduro de ZAP: los que existen tienen 5 estrellas o menos y no se instalaron; ZAP se maneja por su API REST.

## Medido el 19/10 con JavaScript real

Bundle publico de la ficha de producto de Frávega (`/_next/static/chunks/pages/_app-*.js`, 928 KB):

| | webcrack | Wakaru |
|---|---|---|
| Modulos desempacados | 276 | 276 |
| Tiempo (archivo de 112 KB) | 6,6 s | 2,2 s |
| Tiempo (archivo de 928 KB) | 43 s | n/d |
| Aporta de mas | Desofusca obfuscator.io y evalua constantes | Nombres mas legibles, source maps, mas rapido; avisa de modulos que no pudo convertir |

Lo que salio de leer ese JS: consultas GraphQL (`categoryMenu`, `searchSuggestion`, `logistics`, `postalCodes`) y un endpoint REST (`/api/v2/rest/newsletter/subscribe`). La consulta que trae precio y stock (`getProductDetails_Shopping`) no estaba en ese bundle: se vio con el cliente Apollo de la pagina abierta. **Frávega no se puede usar igual**: su `POST /api/v2` devuelve 403 de CloudFront a los servidores de GitHub.

## Como se usa

- **Que llama la pagina**: abrirla en el navegador, mirar la red (Chrome DevTools MCP o la pestaña Red) y filtrar por `api`, `graphql`, `catalog_system`, `wp-json`.
- **Que dice el JS**: bajar los `.js` de `/_next/static/` y correr `webcrack archivo.js -o salida` o `wakaru archivo.js -o salida.js`; buscar con `grep` `query `, `mutation `, `/api/` y `fetch(`.
- **Probar la API desde GitHub**: sumar el caso a `diagnostico_enlaces.py` (como `--vtex`) y correr `gh workflow run diagnostico.yml --ref <rama>`.
- **mitmproxy** solo en `127.0.0.1` (no se expone en la red local); la captura va a `privado/` (ignorada por Git).
- **ZAP sobre el sitio propio**: `zap-baseline.py` (pasivo) contra `https://pichinchadeldia.com.ar`; es una buena tarea para el siguiente paso de seguridad.
