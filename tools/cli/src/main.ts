#!/usr/bin/env node
/**
 * `ycore` — CLI de administración del update-worker (ADR-0005, punto 5).
 *
 * Sirve como el único punto de entrada para las cinco operaciones admin
 * (`release`, `maintenance`, `yank`, `rollout`, `block`) más `stats`, todas
 * contra `POST/GET /v1/admin/*`. **Nunca firma nada**: la firma Ed25519 del
 * manifest vive solo en el pipeline de CI (ADR-0005, punto 5). Lee
 * `YCORE_WORKER_URL` y `YCORE_ADMIN_TOKEN` del entorno.
 *
 * Uso: `ycore <comando> --flag valor ...`
 */

import { runRelease } from './commands/release.js';
import { runMaintenance } from './commands/maintenance.js';
import { runYank } from './commands/yank.js';
import { runRollout } from './commands/rollout.js';
import { runBlock } from './commands/block.js';
import { runStats } from './commands/stats.js';

const COMMANDS: Readonly<Record<string, (args: readonly string[]) => Promise<void>>> = {
  release: runRelease,
  maintenance: runMaintenance,
  yank: runYank,
  rollout: runRollout,
  block: runBlock,
  stats: runStats,
};

function printUsage(): void {
  console.error(`Uso: ycore <comando> --flag valor ...\n\nComandos: ${Object.keys(COMMANDS).join(', ')}`);
}

async function main(argv: readonly string[]): Promise<void> {
  const [command, ...rest] = argv;

  if (command === undefined || !(command in COMMANDS)) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  await COMMANDS[command]!(rest);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(`FALLO: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
