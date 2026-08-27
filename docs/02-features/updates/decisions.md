# Actualizaciones — decisiones locales

Decisiones de implementación de esta feature que no ameritaron ampliar el ADR-0003 (no
cambian una frontera del monorepo ni una decisión ya cerrada allí).

## Solo descarga completa en esta iteración, sin diferencial por blockmap

El ADR-0003 prevé descarga diferencial vía `.blockmap` + `Range` requests, y
`CheckResponseSchema.artifact.delta`/`services/update-worker` ya sirven la URL firmada
del blockmap si existe. `UpdateService.downloadAndVerify` ignora ese campo por ahora y
siempre descarga `artifact.url` completo: aplicar un `.blockmap` sobre el binario
instalado (reconstruir el instalador nuevo a partir del viejo + el diferencial) es una
pieza de complejidad propia (parseo del formato de electron-builder) que no era
necesaria para que el ciclo completo — comprobar, descargar, verificar, instalar — ya
funcione de extremo a extremo. Queda como trabajo pendiente explícito para una
iteración futura; no rompe nada mientras tanto porque el resto de la cadena de
confianza (Ed25519 + SHA-512) es idéntica para ambos caminos.

## El estado de la actualización no se persiste en DB

A diferencia de `DownloadState` (ADR-0004, que sí persiste en la tabla `downloads` para
sobrevivir a un `kill -9`), `UpdateStatus` vive solo en memoria de `UpdateService`. Si
Y-CORE se cierra a mitad de una descarga o verificación, al reabrir se vuelve a
`checkNow()` desde el principio — una comprobación es barata (una request HTTP) y el
Worker siempre puede volver a emitir URLs firmadas nuevas, así que no hay nada que
"reanudar" que valga la pena persistir. Simplifica la feature entera: sin migración,
sin repositorio de descargas de updates, sin lógica de resumeInterrupted().

## `ClientIdRepository` usa la tabla genérica `settings`, no una tabla propia

El `clientId` (ADR-0005, punto 6: UUID v4 estable entre arranques, para el rollout
determinista) es el único dato de configuración persistente que la app necesita hoy.
En vez de una tabla `client_id` de una sola fila, se usa `settings` (clave-valor
genérica) — si en el futuro hace falta guardar el canal elegido por el usuario o algún
otro ajuste, se añade como otra fila de la misma tabla, sin migración nueva.

## La config de `UpdateService` se lee de variables de entorno, con modo inerte si falta

`YCORE_WORKER_URL`, `YCORE_CLIENT_SECRET` y `YCORE_MANIFEST_PUBLIC_KEYS` se leen de
`process.env` en `bootstrap/update-scheduler.ts`, nunca hardcodeadas en el código
fuente (son secretos de build, distintos por canal/entorno). Si falta alguna, en vez de
fallar el arranque de la app, se construye un `UpdateService` "inerte" que siempre
reporta `up-to-date` — comprobar actualizaciones nunca puede ser un requisito para que
Y-CORE abra.

Esta garantía de runtime queda intacta, pero de dónde salen esas tres variables en un
`.exe` real sí es una decisión de arquitectura, y está en **ADR-0006**: en build time,
`electron.vite.config.ts` las sustituye como literales en `out/main/index.js` con
`define` (nunca en `preload`/`renderer`), leyendo de GitHub Secrets en CI o de
`apps/desktop/.env.local` en dev. Un build de release (`YCORE_REQUIRE_UPDATE_CONFIG=1`)
sin las tres falla el CI en vez de publicar un `.exe` que nunca podrá avisar de su
propio arreglo. Ver ADR-0006 para el porqué completo y las alternativas descartadas.

## `installNow` recibe `onBeforeQuit` como callback inyectado, no importa `electron.app`

`UpdateService`/`handlers.ts` no importan `electron` directamente: `main/index.ts` pasa
`() => app.quit()` al construir el registry. Mismo criterio que el resto de
`main/features/*` (que tampoco tocan Electron salvo a través de lo que el bootstrap les
inyecta) — permite testear `UpdateService.installNow` sin un mock de todo el módulo
`electron`.

## `downloadToFile` usa `Readable.from(response.body as unknown as AsyncIterable<Uint8Array>)`, no `Readable.fromWeb`

`main/features/downloads/http-client.ts` castea `response.body` a
`Parameters<typeof Readable.fromWeb>[0]` porque ese archivo, en su "programa" TS
aislado, no arrastra ningún otro archivo que resuelva lib DOM. `main/features/updates/download.ts`
sí lo hace (por la cadena de imports hacia `packages/updater-client`, que usa
`crypto.subtle` con tipos que varían según si el `tsconfig` del consumidor declara lib
DOM), así que `Readable.fromWeb` con ese mismo cast dejaba de compilar bajo un
`tsconfig` y de pasar lint bajo el otro — dos herramientas viendo dos "programas" TS
distintos en el mismo repo (`tsc --noEmit -p tsconfig.node.json` aislado vs. el
`projectService` de ESLint, que combina `tsconfig.node.json` y `tsconfig.web.json`).
Se evitó por completo con `Readable.from` sobre un cast a `AsyncIterable<Uint8Array>`
(no a `ReadableStream`, cuya forma exacta es la que varía): `response.body` es un async
iterable en runtime bajo cualquier resolución de tipos, así que el cast es válido en
ambos "programas" a la vez y ninguna herramienta se queja. Ver `aprendizaje.md` para el
diagnóstico completo.
