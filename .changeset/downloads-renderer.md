---
"@ycore/desktop": minor
---

Añade el lado renderer del motor de descargas (cierre de Fase 4): `useDownloadsQuery`
(polling de `downloads.list` cada 500 ms mientras haya una descarga activa),
`useEnqueueDownload`/`usePauseDownload`/`useCancelDownload` (mutaciones que invalidan la
cola al completar), y la pantalla `DownloadsList` con `DownloadRow` por descarga
(estado, progreso, pausar, cancelar). Montada en `App.tsx` junto a la biblioteca, sin
router todavía.
