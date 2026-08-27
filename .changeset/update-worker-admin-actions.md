---
"@ycore/update-worker": minor
"@ycore/update-contract": minor
---

Añade las tres rutas admin que faltaban para que `services/update-worker` cubra las
cinco operaciones que el ADR-0005 (punto 5) le promete a la CLI `ycore`: `yank` (retira
una release publicada sin borrar su historial), `rollout` (cambia el porcentaje de
rollout de un canal sin publicar una release nueva) y `block` (kill-switch: bloquea una
versión y fuerza la actualización). Las tres quedan auditadas en la migración nueva
`admin_actions_log` (`0002_admin_actions_log.sql`); `maintenance` sigue con su propia
`maintenance_log`. El router pasa de una cadena de `if` a una tabla constante `ROUTES`,
tal como el ADR-0005 pedía desde el principio.

`@ycore/update-contract` gana `AdminYankSchema`, `AdminRolloutSchema` y
`AdminBlockSchema`, con `.describe()` en cada campo.
