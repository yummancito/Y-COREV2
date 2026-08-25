#!/usr/bin/env node
/**
 * check-done — hook Stop.
 *
 * Se ejecuta cuando Claude intenta cerrar una tarea. Corre las verificaciones
 * baratas (documentación de features) y, si algo falta, bloquea el cierre con
 * exit 2 explicando exactamente qué queda por documentar.
 *
 * No corre lint/test aquí: son lentos y ya los cubre CI. Este hook solo
 * protege lo que a un agente se le olvida de verdad — la documentación.
 *
 * Salida: exit 0 = puede cerrar · exit 2 = bloqueado (stderr = qué falta).
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = process.cwd();
const checkDocs = join(REPO_ROOT, 'tools', 'scripts', 'check-docs.mjs');

// Si el repo aún no tiene el checker (bootstrap muy temprano), no bloqueamos.
if (!existsSync(checkDocs)) process.exit(0);

const result = spawnSync(process.execPath, [checkDocs], {
  cwd: REPO_ROOT,
  encoding: 'utf8',
});

if (result.status !== 0) {
  console.error(
    `BLOQUEADO: no puedes cerrar la tarea todavía:\n\n${result.stderr || result.stdout}\n` +
      `Documenta lo que falta y vuelve a intentarlo.`,
  );
  process.exit(2);
}

process.exit(0);
