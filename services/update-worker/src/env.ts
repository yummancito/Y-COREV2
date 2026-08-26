/**
 * `WorkerEnv` — los bindings de Cloudflare que `wrangler.jsonc` declara, más
 * los secrets que `wrangler secret put` añade en runtime (no aparecen en el
 * `Env` generado por `wrangler types`, porque ese comando solo ve los
 * bindings declarados en el archivo de config, no los secrets).
 *
 * Sirve como el único lugar que nombra los bindings reales — el resto del
 * Worker recibe `WorkerEnv` como parámetro, nunca toca un global de
 * Cloudflare directamente.
 */

export interface WorkerEnv extends Env {
  /** Secreto compartido para validar `X-YCore-Signature` y firmar URLs de descarga (ADR-0005, puntos 6-7). */
  readonly YCORE_CLIENT_SECRET: string;
  /** Token bearer que autentica los endpoints `/v1/admin/*`. */
  readonly YCORE_ADMIN_TOKEN: string;
}
