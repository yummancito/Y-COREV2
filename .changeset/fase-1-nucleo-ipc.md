---
"@ycore/desktop": minor
"@ycore/ipc-contract": minor
---

Cierra la Fase 1 del roadmap: contrato IPC tipado (`packages/ipc-contract`), el único
router `ipcMain.handle` del repo con validación Zod de entrada y salida, y un preload
sin `invoke()` genérico — `window.ycore.<feature>.<verbo>(input)` es lo único que el
renderer puede llamar, generado automáticamente desde el contrato. La ventana principal
arranca con `contextIsolation`, `sandbox` on y `nodeIntegration` off.
