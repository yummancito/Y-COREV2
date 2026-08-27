/**
 * `readCliConfig` — lee la URL del Worker y el bearer token de administración
 * del entorno.
 *
 * Sirve para que ningún comando de la CLI tenga que decidir por su cuenta de
 * dónde sale esta configuración, y para dar un mensaje de error claro (en vez
 * de un `fetch` fallando con una URL `undefined`) si falta alguna.
 *
 * @returns La URL base del Worker y el token, o lanza un `Error` con qué
 *   variable falta — la CLI corre en una terminal humana, no cruza una
 *   frontera del producto, así que lanzar aquí es la forma más directa de
 *   detener la ejecución con un mensaje útil.
 */
export interface CliConfig {
  readonly baseUrl: string;
  readonly adminToken: string;
}

export function readCliConfig(env: NodeJS.ProcessEnv = process.env): CliConfig {
  const baseUrl = env['YCORE_WORKER_URL'];
  if (baseUrl === undefined || baseUrl.length === 0) {
    throw new Error('Falta YCORE_WORKER_URL en el entorno (p. ej. https://updates.y-core.app).');
  }

  const adminToken = env['YCORE_ADMIN_TOKEN'];
  if (adminToken === undefined || adminToken.length === 0) {
    throw new Error('Falta YCORE_ADMIN_TOKEN en el entorno.');
  }

  return { baseUrl, adminToken };
}
