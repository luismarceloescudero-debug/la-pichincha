// Reintentos de las pruebas de punta a punta segun quien las corre (auditoria 17/11, punto 2).
// - Un PR (pull_request) o la PC de quien desarrolla (sin GITHUB_EVENT_NAME): 0. Una prueba intermitente se arregla, no se
//   tapa (N-T1).
// - La publicacion diaria (actualizar.yml llama a tests.yml con workflow_call; ahi GITHUB_EVENT_NAME es el evento del
//   llamador: schedule, workflow_dispatch o push): 1. Un fallo al azar no puede dejar el dia sin publicar.
function reintentos(evento) {
  return evento && evento !== "pull_request" ? 1 : 0;
}

module.exports = { reintentos };
