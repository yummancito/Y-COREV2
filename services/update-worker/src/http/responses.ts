/**
 * Helpers de `Response` — el vocabulario HTTP hacia fuera (ADR-0005, punto 4:
 * códigos de estado + body mínimo, nunca `Result` serializado).
 */

/** `200` con un body JSON. */
export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/** Respuesta sin body, para `403`/`401`/`404` — el cliente no necesita más que el código. */
export function empty(status: number): Response {
  return new Response(null, { status });
}

/** `400` con un error mínimo — solo para los endpoints admin (ADR-0005, tabla del punto 4). */
export function badRequest(code: string, detail: string): Response {
  return json({ error: code, detail }, 400);
}

/** `500` opaco: nunca se filtra un stack trace ni un mensaje interno al cliente. */
export function internalError(): Response {
  return empty(500);
}
