#!/usr/bin/env node
/**
 * check-contract — verifica la correspondencia bidireccional entre
 * `packages/ipc-contract` y `apps/desktop/src/main/ipc/registry.ts`.
 *
 * Sirve para que "todo canal tiene handler, todo handler está en el contrato"
 * (ADR-0002) sea algo que CI verifica, no algo que se asume. TypeScript ya
 * fuerza esto en compilación (`Registry` exige las 100% de las claves de
 * `ChannelName`), pero este script existe para que `pnpm check:contract`
 * tenga contenido real y falle con un mensaje claro si algún día el tipado
 * se relaja (p. ej. un `Partial<Registry>` colado por error).
 *
 * `buildRegistry` necesita una conexión de DB (los handlers de features la
 * usan), así que este script abre una en memoria solo para inspeccionar las
 * claves del registry resultante — no se leen ni escriben datos reales.
 *
 * Uso:  pnpm check:contract (desde apps/desktop)
 * Salida: exit 0 = ok · exit 1 = desincronizado (lista qué falta)
 */

import { join } from 'node:path';
import { contract } from '@ycore/ipc-contract';
import { openDatabase } from '../db/index.js';
import { UpdateService } from '../features/updates/index.js';
import { buildRegistry } from './registry.js';

const db = openDatabase(':memory:', join(import.meta.dirname, '../db/migrations'));
const updateService = new UpdateService({
  workerBaseUrl: 'http://127.0.0.1:0',
  clientSecret: '',
  manifestPublicKeysBase64: [],
  currentVersion: '0.0.0',
  channel: 'stable',
  clientId: '00000000-0000-4000-8000-000000000000',
});
const registry = buildRegistry(db, updateService, () => {});
db.$client.close();

const contractChannels = new Set(Object.keys(contract));
const registryChannels = new Set(Object.keys(registry));

const sinHandler = [...contractChannels].filter((c) => !registryChannels.has(c));
const sinCanal = [...registryChannels].filter((c) => !contractChannels.has(c));

if (sinHandler.length > 0 || sinCanal.length > 0) {
  console.error('FALLO: check:contract no pasó:\n');
  for (const c of sinHandler) console.error(`  • "${c}" está en el contrato pero no tiene handler en registry.ts`);
  for (const c of sinCanal) console.error(`  • "${c}" tiene handler en registry.ts pero no está en el contrato`);
  process.exit(1);
}

console.log(`OK: check:contract — ${contractChannels.size} canal(es) con correspondencia 1 a 1.`);
