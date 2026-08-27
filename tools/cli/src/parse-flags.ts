/**
 * `parseFlags` — convierte `--clave valor` (y `--flag` booleano sin valor) en
 * un `Record<string, string | boolean>`.
 *
 * Sirve como el único parser de argumentos de la CLI: son seis subcomandos
 * fijos con flags conocidos de antemano, así que un parser de ~15 líneas
 * alcanza y evita meter una dependencia (commander/yargs) para esto —mismo
 * criterio con el que el ADR-0005 descartó un framework de routing para el
 * Worker.
 *
 * @param args - Los argumentos ya sin el nombre del subcomando (`process.argv.slice(3)`).
 * @returns Un mapa `--version 5.1.0` -> `{ version: '5.1.0' }`, `--mandatory` -> `{ mandatory: true }`.
 */
export function parseFlags(args: readonly string[]): Record<string, string | boolean> {
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]!;
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i += 1;
    }
  }

  return flags;
}

/** Lee un flag de string obligatorio, o lanza un `Error` con qué falta. */
export function requireString(flags: Record<string, string | boolean>, key: string): string {
  const value = flags[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Falta --${key} <valor>.`);
  }
  return value;
}

/** Lee un flag numérico obligatorio, o lanza un `Error` con qué falta o por qué no es un número. */
export function requireNumber(flags: Record<string, string | boolean>, key: string): number {
  const raw = requireString(flags, key);
  const value = Number(raw);
  if (Number.isNaN(value)) throw new Error(`--${key} debe ser un número, recibido "${raw}".`);
  return value;
}

/** Lee un flag booleano; ausente cuenta como `false`. */
export function readBoolean(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true || flags[key] === 'true';
}
