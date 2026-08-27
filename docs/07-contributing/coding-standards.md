# Estándares de código

Reglas inviolables (rompen `pnpm check:all` o el hook de escritura). La fuente de
verdad completa está en `.claude/CLAUDE.md` — este documento la explica para quien no
tiene ese archivo delante.

## Límites de tamaño

- **400 líneas por archivo, 60 por función**, complejidad ciclomática 12. No negociable:
  si te acercas, divide. No es "este caso es especial" — es señal de que hay más de
  una responsabilidad en ese archivo/función.
- El checker `check-file-rules.mjs` bloquea la escritura antes de llegar a `pnpm lint`.

## Tipos

- **Prohibido `any`.** Usa `unknown` + Zod para parsear cualquier dato que entre desde
  fuera del programa (IPC, HTTP, disco).
- `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` activados en todo el
  monorepo (`packages/tsconfig/base.json`) — un `undefined` implícito es un error de
  tipos, no un bug que aparece en producción.

## Errores

- **Prohibido `throw` cruzando una frontera** (IPC, plugin, servicio). `Result<T,
  AppError>` — ver [`../01-architecture/error-handling.md`](../01-architecture/error-handling.md).
- Un `try/catch` alrededor de código de terceros que sí lanza es la única frontera
  donde se admite `fromUnknown(error)`; después de esa conversión, sigue siendo
  `Result` hacia arriba.

## Boundaries

- **Prohibido importar entre features.** Ver
  [`../01-architecture/boundaries.md`](../01-architecture/boundaries.md) para la matriz
  completa, verificada por `eslint-plugin-boundaries`.
- **Prohibido meter datos del main process en zustand.** Ver
  [`../01-architecture/state-management.md`](../01-architecture/state-management.md).

## Excepciones (`eslint-disable`)

- **Prohibido `eslint-disable` sin un comentario `// JUSTIFICACIÓN: ...`** justo
  encima, y su entrada correspondiente en [`../exceptions.md`](../exceptions.md). El
  hook `check-file-rules.mjs` (regla R6) lo bloquea si falta cualquiera de las dos
  cosas.
- Que la lista de `exceptions.md` sea corta es una métrica de salud del proyecto — no
  un objetivo en sí mismo.

## Nomenclatura y estructura de commits/versiones

- **Conventional Commits + commitlint**, con un scope de una lista cerrada
  (`commitlint.config.mjs`) que hay que ampliar al crear un package/app/service nuevo.
- **Changesets** para el changelog: cada cambio de cara al usuario lleva su
  `.changeset/*.md` describiendo el impacto, no el detalle técnico.
- El subject de un commit no puede empezar con una sigla en mayúsculas (`CLI`, `IPC`) —
  commitlint lo interpreta como sentence/start-case y lo rechaza; usar minúscula o
  reformular.

## Cosas que no se hacen en este repo (`.claude/CLAUDE.md`)

- No reintroducir `electron-updater` (ver ADR-0003).
- No crear un "V2" de un store o feature existente — se refactoriza el original o se
  borra.
- No dejar código comentado "por si acaso" — está en git.
- No escribir informes de auditoría en `.md` sueltos — abre un issue, o documenta la
  decisión como ADR si cambia arquitectura.
- No meter secretos ni API keys en el cliente — todo pasa por el Worker o por
  variables de entorno de build, nunca hardcodeado.

## Cero emojis

Nada de emojis en código, comentarios, TSDoc, commits, nombres de archivo, logs de
consola, mensajes de error ni salida de los checkers. En vez de un emoji de estado usa
la palabra (`OK`, `FALLO`, `Bloqueado`); en vez de un aviso, un bloque `> Aviso:` o
`> Importante:`. Los caracteres de dibujo ASCII en diagramas sí están permitidos.
