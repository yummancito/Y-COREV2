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
  components/                   DownloadsList (pantalla), DownloadRow (una fila),
                                 EnqueueDownloadForm (formulario manual, ver "Estado")
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
IPC, y la pantalla de la cola de descargas montada en `App.tsx`. Verificado
end-to-end el criterio de HECHO más duro de la fase, **en la app real de Electron**
(no solo en tests): encolar una descarga real, matar el proceso a mitad
(`Stop-Process -Force`, no `pause()`) y reabrir la app retoma la descarga desde el
offset real, pide el `Range` HTTP correcto, y termina instalada con la integridad
SHA-256 verificada.

Esa verificación en vivo encontró y arregló dos bugs reales que el test original
(con estado post-kill simulado a mano) no detectaba — ver `aprendizaje.md`,
2026-09-01: (1) `bytesDownloaded` no se persistía mientras se escribía a disco,
solo al abrir el stream — ahora `ProgressThrottle` (`packages/core-domain`) está
conectado al pipeline de escritura y persiste el progreso real a ~4/s; (2) el
offset de reanudación usa el tamaño real del archivo en disco (`bytesOnDisk`,
`fs.stat`), no `bytesDownloaded` de la fila — esa fila puede ir por detrás del
disco real en el instante exacto del `kill -9`, y confiar en ella duplicaba bytes
al reabrir en modo append.

`EnqueueDownloadForm` (montado dentro de `DownloadsList`) es un formulario manual
(App ID + URL + ruta + SHA-256) que existe **solo** para poder ejercitar
`downloads.enqueue` desde la app real — no resuelve catálogos ni sabe de Steam,
y no es el flujo final de "elegir qué descargar" (ver más abajo).

**Lo que falta, fuera del alcance de esta fase**: un flujo real de "elegir qué
descargar" que resuelva URL y hash automáticamente — el formulario manual actual
es un puente de verificación, no ese flujo. Eventos push main→renderer en vez de
polling (ver [decisions.md](decisions.md)). Configurar `maxBytesPerSecond` desde
Ajustes.
