---
"@ycore/desktop": patch
---

`UpdateService.checkNow()` ahora envuelve todo el ciclo en un try/catch: cuando
faltan las variables de entorno de updates (`YCORE_WORKER_URL`, etc.), el servicio
"inerte" firmaba con un `clientSecret` vacío, lo que revienta a nivel de WebCrypto
(`DataError: Zero-length key is not supported`) antes de llegar a la petición de
red. Esa excepción se propagaba como promesa rechazada sin manejar en cada arranque
de la app en desarrollo. Ahora degrada a `up-to-date` en silencio, como manda
ADR-0003: el usuario nunca ve un error de actualización.
