# Feature: Descargas

Fase 4 del roadmap (ADR-0004). El motor de descargas: un solo store de verdad para
la cola, con máquina de estados explícita, reanudación tras matar el proceso, y cero
descargas duplicadas concurrentes.

## Qué hace (cuando esté completa)

- Descarga un archivo desde una URL HTTP(S) que le llega como dato (no resuelve
  catálogos ni sabe de Steam — ver ADR-0004, sección "De dónde vienen los archivos").
- Reanuda una descarga interrumpida por `kill -9` del proceso, retomando desde el byte
  que ya estaba en disco.
- Verifica la integridad del archivo (SHA-256) antes de extraerlo.
- Extrae ZIP de forma segura (protegido contra zip-slip) al directorio de instalación.
- Emite progreso al renderer con throttle (~4 eventos/s), nunca perdiendo el último
  evento antes de una transición de estado.

## Cómo encaja

```
packages/core-domain/
  download-state.ts       DownloadState (unión discriminada) + transition() + ALLOWED_TRANSITIONS
  progress-throttle.ts     ProgressThrottle: agrupa progreso a ~4/s sin perder el último
  token-bucket.ts          TokenBucket: límite de ancho de banda

apps/desktop/src/main/features/downloads/
  download-record.ts       DownloadRecord = DownloadState + metadatos fijos (URL, rutas, hash)
  repository.ts            tabla `downloads` (Drizzle) <-> DownloadRecord
  test-helpers.ts          openInMemoryDb + fakeMetadata para tests
```

Ver [data-model.md](data-model.md) para el esquema de la tabla `downloads` y el mapeo
a `DownloadState`, [decisions.md](decisions.md) para decisiones locales que no
ameritaron ampliar el ADR. El diseño completo (por qué `undici`, por qué SHA-256 en vez
de SHA-512, por qué solo ZIP con `yauzl`, por qué el índice único parcial, etc.) está en
[ADR-0004](../../adr/0004-motor-de-descargas.md) — no se repite aquí.

## Estado

**En construcción, primeras dos capas de Fase 4 completas:**

1. Núcleo puro en `core-domain` (`transition`, `ProgressThrottle`, `TokenBucket`) —
   100% cobertura, 90 tests.
2. Esquema Drizzle de `downloads` (con el índice único parcial que impide duplicados) y
   `DownloadRepository` — 97% cobertura.

**Todavía no existen** (siguientes capas, en este orden): `http-client.ts` (Range,
`If-Range`, reanudación, truncado si el servidor no soporta Range), `verifier.ts`
(SHA-256 incremental), `extractor.ts` (ZIP con `yauzl`, protección zip-slip),
`service.ts` (orquesta todo lo anterior contra la máquina de estados), `handlers.ts` +
canal `downloads.*` en `packages/ipc-contract`, y el lado renderer completo
(`renderer/features/downloads/`: store de UI, hooks de TanStack Query, componentes).

Sin servicio ni handlers todavía, esta feature **no tiene ningún canal IPC ni UI
funcional** — es infraestructura interna sin consumidor externo por ahora.
