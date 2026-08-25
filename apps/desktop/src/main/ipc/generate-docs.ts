#!/usr/bin/env node
/**
 * generate-docs — genera `docs/01-architecture/ipc-contract.md` desde las
 * `.describe()` de `packages/ipc-contract`.
 *
 * Sirve para que la doc de canales IPC nunca se escriba a mano ni se
 * desincronice del contrato real: cada canal documentado es literalmente lo
 * que dice su schema Zod, extraído en runtime con `toJSONSchema` (regla de
 * documentación de .claude/CLAUDE.md: "la doc de canales se genera desde ahí").
 *
 * Vive en `apps/desktop` (no en `tools/scripts/`) porque necesita las
 * dependencias reales del workspace (`@ycore/ipc-contract`, `zod`) — un script
 * en `tools/scripts/` no tiene `node_modules` propio y no puede resolverlas.
 *
 * Uso:  pnpm --filter @ycore/desktop docs:ipc
 * Salida: sobrescribe docs/01-architecture/ipc-contract.md
 */

import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import { contract } from '@ycore/ipc-contract';

/** Sube desde cwd hasta encontrar `.git`, igual que check-file-rules.mjs. */
function findRepoRoot(startPath: string): string {
  let dir = resolve(startPath);
  for (;;) {
    if (existsSync(resolve(dir, '.git'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error(`No se encontró la raíz del repo (.git) desde ${startPath}`);
    dir = parent;
  }
}

interface JsonSchemaField {
  readonly type?: string;
  readonly description?: string;
}

interface JsonSchemaShape {
  readonly type?: string;
  readonly description?: string;
  readonly properties?: Readonly<Record<string, JsonSchemaField>>;
  readonly required?: readonly string[];
}

/** Renderiza un schema Zod como un bloque de campos legible, sin volcar el JSON Schema crudo. */
function renderShape(schema: z.ZodType): string {
  const jsonSchema = z.toJSONSchema(schema) as JsonSchemaShape;
  if (jsonSchema.type !== 'object' || !jsonSchema.properties) {
    return `\`${jsonSchema.type ?? 'unknown'}\` — ${jsonSchema.description ?? 'sin descripción'}`;
  }

  const required = new Set(jsonSchema.required ?? []);
  const fields = Object.entries(jsonSchema.properties).map(([key, value]) => {
    const optional = required.has(key) ? '' : '?';
    const desc = value.description ? ` — ${value.description}` : '';
    return `  - \`${key}${optional}: ${value.type ?? 'unknown'}\`${desc}`;
  });

  return fields.length > 0 ? fields.join('\n') : '  (sin campos)';
}

function renderChannel(name: string, definition: (typeof contract)[keyof typeof contract]): string {
  return [
    `### \`${name}\``,
    '',
    definition.input.description ?? '_sin descripción_',
    '',
    '**Input:**',
    '',
    renderShape(definition.input),
    '',
    '**Output:**',
    '',
    definition.output.description ?? '_sin descripción_',
    '',
    renderShape(definition.output),
    '',
  ].join('\n');
}

function groupByNamespace(
  channels: typeof contract,
): Map<string, [string, (typeof contract)[keyof typeof contract]][]> {
  const groups = new Map<string, [string, (typeof contract)[keyof typeof contract]][]>();
  for (const [name, def] of Object.entries(channels)) {
    const namespace = name.split('.', 1)[0] as string;
    const entry = groups.get(namespace) ?? [];
    entry.push([name, def]);
    groups.set(namespace, entry);
  }
  return groups;
}

function render(channels: typeof contract): string {
  const groups = groupByNamespace(channels);
  const sections = [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, entries]) => {
      const channelDocs = entries
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, def]) => renderChannel(name, def))
        .join('\n');
      return `## Namespace \`${namespace}.*\`\n\n${channelDocs}`;
    })
    .join('\n');

  return `# Contrato IPC — canales

> **Generado automáticamente desde \`packages/ipc-contract\`. No editar a mano.**
> Para cambiar esta página, edita el \`.describe()\` del canal en el contrato y
> vuelve a correr \`pnpm --filter @ycore/desktop docs:ipc\`.

Cada canal se invoca desde el renderer como \`window.ycore.<namespace>.<verbo>(input)\`.
Ver ADR-0002 para el diseño completo de la frontera IPC.

${sections}
`;
}

const repoRoot = findRepoRoot(process.cwd());
const outputPath = join(repoRoot, 'docs', '01-architecture', 'ipc-contract.md');

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, render(contract));
console.log(`OK: generado docs/01-architecture/ipc-contract.md con ${Object.keys(contract).length} canal(es).`);
