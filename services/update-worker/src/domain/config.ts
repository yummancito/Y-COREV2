/**
 * Tipos del estado en KV (`YCORE_CONFIG`, roadmap C.3) — el hot path cacheado
 * en el edge que decide mantenimiento, rollout por canal y kill-switch.
 *
 * Puro: sin I/O. `data/config-kv.ts` es quien lee/escribe esto de verdad.
 */

/**
 * No exportado: hoy solo lo usa `YCoreConfig` en este mismo archivo. Si
 * `data/config-kv.ts` (todavía sin escribir) necesita construir un
 * `ChannelConfig` suelto, se vuelve a exportar entonces.
 */
interface ChannelConfig {
  readonly latest: string;
  readonly rollout: number;
  readonly minSupported: string;
}

/** No exportado, mismo motivo que {@link ChannelConfig}. */
interface BlockedVersion {
  readonly reason: string;
  readonly forceTo: string;
}

export interface YCoreConfig {
  readonly maintenance: { readonly enabled: boolean; readonly since: string | null; readonly note: string };
  readonly channels: Readonly<Record<string, ChannelConfig>>;
  readonly blocked: Readonly<Record<string, BlockedVersion>>;
  readonly checkIntervalSeconds: number;
}
