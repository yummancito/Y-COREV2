---
"@ycore/desktop": patch
---

Arregla dos bugs reales del motor de descargas encontrados probando en la app
real de Electron (matar el proceso a mitad de una descarga y reabrir): el
progreso ya no se persistía mientras se escribía a disco, y la reanudación
usaba el `bytesDownloaded` de la DB (que puede ir por detrás del disco real por
el throttle de progreso) en vez del tamaño real del archivo, corrompiendo la
descarga al reabrir. Agrega también un formulario manual (App ID/URL/ruta/hash)
para poder encolar descargas desde la app real mientras no exista una feature
de "elegir qué descargar".
