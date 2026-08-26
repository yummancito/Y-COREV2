# Feature: Descargas

Fase 4 del roadmap (ADR-0004). El motor de descargas: un solo store de verdad para
la cola, con máquina de estados explícita, reanudación tras matar el proceso, y cero
descargas duplicadas concurrentes.

## Qué hace

- Descarga un archivo desde una URL HTTP(S) que le llega como dato (no resuelve
  catálogos ni sabe de Steam — ver ADR-0004, sección "De dónde vienen los archivos").
- Reanuda una descarga interrumpida por `kill -9` del proceso, retomando desde el byte
  que ya estaba en disco (`resumeInterrupted()`, llamado una vez en el bootstrap).
- Verifica la integridad del archivo (SHA-256) antes de extraerlo.
- Extrae ZIP de forma segura (protegido contra zip-slip) al directorio de instalación.
- Limita el ancho de banda si se configura un `maxBytesPerSecond` (por defecto, sin
  límite — no hay UI de Ajustes todavía que lo exponga).
- El renderer lee el progreso haciendo **polling** de `downloads.list` (no hay eventos
  push main→renderer en este repo todavía; ver [decisions.md](decisions.md)).

## Cómo encaja

```
packages/core-domain/
  download-state.ts       DownloadState (unión discriminada) + transition() + ALLOWED_TRANSITIONS
  progress-throttle.ts     ProgressThrottle: agrupa progreso a ~4/s sin perder el último
  token-bucket.ts          TokenBucket: límite de ancho de banda

apps/desktop/src/main/features/downloads/
  download-record.ts       DownloadRecord = DownloadState + metadatos fijos (URL, rutas, hash)
  repository.ts            tabla `downloads` (Drizzle) <-> DownloadRecord
  http-client.ts           abre la conexión HTTP con reanudación (Range/If-Range)
  verifier.ts              SHA-256 incremental + verificación final del archivo
  extractor.ts             extracción de ZIP con yauzl, protegida contra zip-slip
  service.ts               orquesta todo lo anterior contra transition() + dedupe en memoria
  handlers.ts              traduce dominio <-> forma exacta del contrato IPC
  index.ts                 API pública: DownloadRepository, DownloadService, createDownloadHandlers

apps/desktop/src/main/bootstrap/download-resumer.ts
  resumeInterruptedDownloads   llama a DownloadService.resumeInterrupted() en el arranque

apps/desktop/src/renderer/features/downloads/
  index.ts                     API pública: DownloadsList
  hooks/                        useDownloadsQuery (polling), useEnqueueDownload,
                                 usePauseDownload, useCancelDownload
  components/                   DownloadsList (pantalla), DownloadRow (una fila)
```

- `packages/ipc-contract` — canales `downloads.enqueue`, `downloads.list`,
  `downloads.pause`, `downloads.cancel`, ver [ipc-channels.md](ipc-channels.md).

Ver [data-model.md](data-model.md) para el esquema de la tabla `downloads` y el mapeo
a `DownloadState`, [decisions.md](decisions.md) para decisiones locales que no
ameritaron ampliar el ADR, [ui-flows.md](ui-flows.md) para los recorridos de usuario. El
diseño completo (por qué `undici`, por qué SHA-256 en vez de SHA-512, por qué solo ZIP
con `yauzl`, por qué el índice único parcial, etc.) está en
[ADR-0004](../../adr/0004-motor-de-descargas.md) — no se repite aquí.

## Estado

**Fase 4 completa** (main + renderer): núcleo puro, persistencia, I/O, orquestación,
IPC, y la pantalla de la cola de descargas montada en `App.tsx`. 134 tests, ~93% de
cobertura combinada de la feature. Verificado end-to-end el criterio de HECHO más duro
de la fase: una descarga interrumpida a mitad (fila `downloading` en la DB, archivo
parcial en disco) se retoma desde el offset exacto persistido, pidiendo el `Range` HTTP
correcto, y termina instalada.

**Lo que falta, fuera del alcance de esta fase**: un flujo de UI para "elegir qué
descargar" (`useEnqueueDownload` existe y está testeado, pero ningún componente lo
llama todavía — encolar una descarga real necesita saber de dónde sale la URL y el
hash, que es responsabilidad de una feature futura, no de esta). Eventos push
main→renderer en vez de polling (ver [decisions.md](decisions.md)). Configurar
`maxBytesPerSecond` desde Ajustes.
