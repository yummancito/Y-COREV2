/**
 * `postAdmin` — llama a un endpoint `POST /v1/admin/*` del update-worker con
 * el bearer token de administración.
 *
 * Sirve como el único punto de la CLI que habla HTTP de verdad, para que
 * cada comando (`release`, `maintenance`, `yank`, `rollout`, `block`) se
 * limite a construir su payload (ya validado contra el schema Zod
 * correspondiente de `@ycore/update-contract`) y delegar el envío aquí.
 *
 * @param baseUrl - URL base del Worker, p. ej. `https://updates.y-core.app`.
 * @param path - Ruta del endpoint admin, p. ej. `/v1/admin/release`.
 * @param adminToken - El bearer token configurado en `YCORE_ADMIN_TOKEN`.
 * @param payload - El body ya validado contra su schema Zod.
 * @returns El body de la respuesta como `unknown` si el status es 2xx.
 * @throws Un `Error` con el status y el body si la respuesta no es 2xx —
 *   la CLI corre en una terminal humana, no cruza una frontera del producto,
 *   así que lanzar y dejar que `main.ts` lo capture en el punto de entrada es
 *   más simple que propagar `Result` por una capa de proceso que termina ahí.
 */
export async function postAdmin(baseUrl: string, path: string, adminToken: string, payload: unknown): Promise<unknown> {
  const response = await fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} respondió ${response.status}: ${text || '(sin body)'}`);
  }
  return text.length > 0 ? (JSON.parse(text) as unknown) : null;
}

/**
 * Llama a un endpoint `GET /v1/admin/*` con el bearer token de administración.
 *
 * @param baseUrl - URL base del Worker.
 * @param path - Ruta del endpoint, incluida la query string si aplica.
 * @param adminToken - El bearer token configurado en `YCORE_ADMIN_TOKEN`.
 * @returns El body de la respuesta como `unknown` si el status es 2xx.
 * @throws Un `Error` con el status y el body si la respuesta no es 2xx.
 */
export async function getAdmin(baseUrl: string, path: string, adminToken: string): Promise<unknown> {
  const response = await fetch(new URL(path, baseUrl), {
    headers: { authorization: `Bearer ${adminToken}` },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${path} respondió ${response.status}: ${text || '(sin body)'}`);
  }
  return text.length > 0 ? (JSON.parse(text) as unknown) : null;
}
