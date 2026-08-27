---
"@ycore/desktop": patch
"@ycore/ipc-contract": patch
---

Corrige un bug real en la feature de actualizaciones: cuando el Worker marcaba la
versión instalada como bloqueada (kill-switch), el cliente lo trataba en silencio como
"estás al día" — el mismo silencio que el modo mantenimiento, pero el kill-switch debe
ser visible. Ahora `UpdateService.checkNow()` distingue `blocked` de `up-to-date` y el
banner del renderer muestra un modal (`role="alertdialog"`) con el mensaje del servidor
y la versión a la que hay que actualizar.
