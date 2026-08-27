---
"@ycore/desktop": minor
"@ycore/update-contract": minor
"@ycore/update-worker": minor
"@ycore/updater-client": patch
---

Y-CORE se actualiza sola: la app comprueba periódicamente si hay una versión nueva
(cada 6 horas y una vez al arrancar), la descarga, verifica su cadena de confianza
completa (firma Ed25519 del manifest + SHA-512 del instalador) y muestra un aviso al
usuario con un botón para instalar y reiniciar cuando quiera — nunca instala sola.
Cualquier fallo de red o verificación se trata en silencio: el usuario nunca ve un
error de comprobación. La descarga diferencial por blockmap queda fuera de esta
iteración (siempre se descarga el instalador completo).

Para que esto fuera posible se cerró un hueco real entre el ADR-0003 y el backend:
`/v1/check` ahora incluye la URL firmada del `manifest.json` que el pipeline de CI
firma con Ed25519 (antes solo exponía el hash sin firma, y no había ninguna forma de
verificarlo de verdad antes de instalar).
