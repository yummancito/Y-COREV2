---
"@ycore/desktop": minor
---

Añade el I/O de bajo nivel del motor de descargas (Fase 4, ADR-0004): `http-client.ts`
(descarga con reanudación real vía `Range`/`If-Range`, sin dependencias nuevas — usa el
`fetch` global de Node/undici), `verifier.ts` (verificación de integridad con SHA-256
incremental) y `extractor.ts` (extracción de ZIP con `yauzl`, protegida contra zip-slip
y enlaces simbólicos, con extracción atómica). Todavía sin servicio, canal IPC ni UI.
