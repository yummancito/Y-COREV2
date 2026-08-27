# Playbook de incidentes

Qué hacer cuando una release publicada resulta ser un problema. Tres herramientas
distintas para tres problemas distintos — no las confundas entre sí.

## Diagnóstico rápido: ¿cuál necesito?

| Síntoma | Herramienta |
|---|---|
| No sé todavía si el problema es de la release o de otra cosa, quiero parar el reloj | `ycore maintenance on` |
| La release en sí está bien, pero quiero que deje de ofrecerse (p. ej. detecté un bug menor antes de que se propague más) | `ycore yank` |
| Los clientes que **ya instalaron** esa versión están en riesgo (corrompe datos, crashea, es insegura) y necesitan forzar la actualización | `ycore block` |

## `ycore maintenance on` — parar todo mientras investigas

Ver [`maintenance-mode.md`](maintenance-mode.md) para el detalle completo. Resumen: es
silencioso, global, y **no cancela descargas en curso**. Úsalo primero si no estás
seguro de qué está pasando — es reversible sin coste y no le habla a nadie.

```bash
pnpm --filter @ycore/cli ycore maintenance --on --note "investigando reporte de crash" --actor <tu-nombre>
```

## `ycore yank` — retirar una release del catálogo

Marca la fila de `releases` como `yanked = 1` en D1. Deja de ofrecerse en `/v1/check`
inmediatamente (sin esperar propagación de KV, es una lectura de D1 en cada check) —
pero **no borra el historial**, y **no afecta a quien ya la instaló**.

```bash
pnpm --filter @ycore/cli ycore yank --version 5.1.0 --actor <tu-nombre>
```

Úsalo cuando el problema es "esta release no debería seguir repartiéndose", pero no
hace falta forzar a nadie que ya la tiene a moverse de ahí.

## `ycore block` — kill-switch, forzar actualización

El más agresivo: marca una versión **instalada** como bloqueada. El cliente en esa
versión recibe `status: "blocked"` en `/v1/check` — **incluso con el modo
mantenimiento activo** (el bloqueo pesa más, es una decisión explícita de
`decideCheckResponse` en `services/update-worker`). El `UpdateBanner` del cliente
muestra un modal (no el banner discreto habitual) exigiendo actualizar.

```bash
pnpm --filter @ycore/cli ycore block \
  --version 5.0.9 --reason "corrompe la base de datos local" \
  --force-to 5.1.0 --actor <tu-nombre>
```

Úsalo solo cuando de verdad hace falta que nadie siga usando esa versión — es visible
para el usuario, a diferencia de `yank` y `maintenance`.

## Auditoría

Toda acción de `yank`/`rollout`/`block` queda en la tabla `admin_actions_log` de D1
(acción, versión/canal, actor, detalle, timestamp); `maintenance` en su propia
`maintenance_log`. `ycore stats --days N` da el agregado de qué versiones están
comprobando los clientes, sin PII, para evaluar el impacto real antes y después de
actuar.

## Orden recomendado ante un incidente real

1. `ycore maintenance on` — para el reloj mientras confirmas qué pasó.
2. `ycore stats --days 1` — mide cuántos clientes están en la versión problemática.
3. Decide `yank` (nadie más la recibe) y/o `block` (los que la tienen deben salir de
   ahí).
4. Publica el fix como una release nueva (ver
   [`release-process.md`](release-process.md)), con rollout inicial 10% otra vez —
   una release de emergencia no se salta la vigilancia progresiva.
5. `ycore maintenance off` una vez el fix esté publicado y verificado.
6. Anota el incidente en `aprendizaje.md` (raíz del repo) — causa, no solo síntoma.
