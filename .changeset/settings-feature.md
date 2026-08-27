---
"@ycore/core-domain": minor
"@ycore/ipc-contract": minor
"@ycore/desktop": minor
---

Y-CORE gana una pantalla de Ajustes: idioma de la interfaz, canal de actualizaciones
(estable/beta), presencia en Discord y minimizar a la bandeja al cerrar. Cada cambio
se guarda al instante, sin botón "Guardar" — y sobrevive a cierres y reinicios de la
app gracias a un esquema versionado que migra la configuración guardada
automáticamente si su forma cambia en el futuro.

El idioma seleccionado todavía no cambia el idioma real de la interfaz (llega con la
Fase 6, i18n completo); Discord y la bandeja del sistema tampoco tienen efecto
todavía — el ajuste queda listo para cuando esas piezas se implementen.
