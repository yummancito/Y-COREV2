---
"@ycore/update-worker": minor
---

Añade el dominio puro de `services/update-worker` (Fase 5, ADR-0005): `rollout.ts`
(bucket determinista para el rollout progresivo), `decide.ts` (junta config +
release + rollout y produce exactamente una de las tres respuestas de `/v1/check`,
incluido el modo mantenimiento indistinguible de "estás al día" y el kill-switch
pesando más que el mantenimiento), `signed-url.ts` (firma y verificación HMAC de URLs
de descarga con TTL de 15 min), y los tipos de `config.ts`/`release-record.ts`. 24
tests contra `workerd` real vía `@cloudflare/vitest-pool-workers`, sin necesitar
ninguna cuenta de Cloudflare. Todavía sin `index.ts` — el servicio no es desplegable
todavía, es solo la lógica de decisión ya verificada de forma aislada.
