# Visión

Y-CORE es un gestor de juegos de Steam para Windows: biblioteca, descargas, y
actualizaciones de la propia app, con **cero deuda técnica** como prioridad número uno.

## Por qué existe este repo

Y-CORE v4.3.12 (el repo anterior, `../Y-CORE`) funciona, pero acumuló deuda que ya
bloqueaba el avance: 167 `ipcMain.handle` dispersos, un preload que exponía
`invoke(channel, ...)` genérico sin allowlist (agujero de seguridad real: el renderer
podía llamar a cualquier canal del main), stores duplicados
(`useLibraryStore`/`useLibraryV2Store`), un `LibraryPage.tsx` de 1985 líneas, ~90 `.md`
de auditorías contradictorias en la raíz, un `.exe` de 428 MB commiteado, y un sistema
de actualizaciones (`electron-updater` contra GitHub Releases públicas) sin control ni
firma que llegó a producir ~400 MB por actualización completa.

Y-CORE V2 es una reconstrucción desde cero, en un repo nuevo, con reglas que hacen
estructuralmente difícil volver a acumular ese tipo de deuda — no solo "tener cuidado",
sino checkers en CI que bloquean el problema antes de que exista.

## Qué es Y-CORE

- Un gestor de biblioteca: importa los juegos ya instalados de Steam, los lanza.
- Un motor de descargas propio (no depende de Steam para instalar contenido externo).
- Una app que se actualiza sola, de forma controlada: rollout progresivo, kill-switch
  de versiones tóxicas, modo mantenimiento silencioso — sin depender de GitHub
  Releases públicas ni de `electron-updater`.
- Windows-only, closed-source, sin presupuesto (0 €: Cloudflare free tier, sin
  certificado de firma de código comercial).

## Qué NO es Y-CORE (todavía, o nunca)

- No es un launcher de Steam ni lo sustituye — lee la biblioteca ya instalada, no la
  gestiona a través de la API de Steam.
- No sirve juegos ni resuelve catálogos desde `services/update-worker` — ese Worker es
  exclusivamente para actualizaciones de la propia app (ver ADR-0005, sección
  "Frontera"). Un backend de catálogo, si llega (Fase 11), es otro Worker con su
  propio ADR.
- No tiene (todavía) plugins, panel admin, ni las fases 7-11 del roadmap — ver
  [roadmap.md](roadmap.md) para el estado real de cada fase.
- No compite en portabilidad: es Windows-only a propósito, no multiplataforma.

## Cómo se decide qué se construye

El documento de referencia es [roadmap.md](roadmap.md): fases numeradas, cada una con
su criterio de "HECHO cuando...". No se empieza una fase nueva sin cerrar la anterior
(o documentar explícitamente qué queda pendiente y por qué, como se ha hecho con la
descarga diferencial por blockmap al cerrar la Fase 5).

Toda decisión de arquitectura no obvia se documenta como ADR en [`adr/`](../adr/) antes
de escribir el código que la implementa — nunca después.
