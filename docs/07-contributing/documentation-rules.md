# Reglas de documentación

Qué se documenta, dónde, y con qué formato — obligatorio, sin excepciones, según
`.claude/CLAUDE.md`.

## TSDoc en toda función, módulo o canal público nuevo

Cuatro partes siempre presentes, en el mismo commit que introduce la función (no
"luego", no en una tarea aparte — una función sin documentar no está terminada):

1. **Qué hace**, en una frase.
2. **Para qué sirve**: qué problema resuelve o en qué caso se usa. Repetir el nombre de
   la función no documenta nada — `// Establece la misión` en `setMission` no dice
   nada, falta el "para qué".
3. **`@param`/`@returns`**: qué recibe y qué devuelve.
4. **Qué pasa si falla**: como está prohibido `throw` cruzando fronteras, qué variante
   de `AppError` puede salir en el `Result` y cuándo.

`@example` si el uso no es trivial.

```ts
/**
 * Resuelve la ruta de instalación de un juego a partir de su appId.
 *
 * Sirve para que la feature de biblioteca sepa dónde lanzar el ejecutable
 * sin volver a leer libraryfolders.vdf en cada llamada.
 *
 * @param appId - Identificador de Steam de la app.
 * @returns La ruta absoluta si el juego está instalado, o un AppError
 *          `game-not-installed` si no se encuentra en ninguna biblioteca.
 */
```

## Feature nueva → `docs/02-features/<feature>/`

Completo, con cinco documentos (ver cualquier feature existente como molde: `library`,
`steam`, `downloads`, `updates`):

- **`README.md`** — qué hace, quién la usa, cómo encaja. Mínimo 200 caracteres reales,
  sin `TODO` sin rellenar (`pnpm check:docs` lo verifica).
- **`data-model.md`** — entidades, tipos y tablas.
- **`ipc-channels.md`** — un puntero corto a
  [`../01-architecture/ipc-contract.md`](../01-architecture/ipc-contract.md) (generado,
  nunca a mano — ver más abajo), no una copia de su contenido.
- **`ui-flows.md`** — si la feature tiene UI, los recorridos de usuario. Incluye
  explícitamente una sección de "lo que no existe todavía" si aplica.
- **`decisions.md`** — decisiones locales que no ameritaron ampliar un ADR (no cambian
  una frontera del monorepo ni una decisión ya cerrada en un ADR aceptado).

`pnpm check:docs` falla si falta cualquiera de estos (salvo `ui-flows.md`, opcional
para features sin UI propia), y el hook `Stop` no deja cerrar la tarea sin ellos.

## Canal IPC nuevo → `.describe()` en Zod, nunca doc a mano

Todo campo de `input`/`output` de un canal lleva `.describe()`. La documentación de
canales (`docs/01-architecture/ipc-contract.md`) se genera desde ahí con
`pnpm --filter @ycore/desktop docs:ipc` — escribirla a mano diverge de la primera
prisa. `assertContractIsFullyDescribed` lo verifica en runtime al importar el
contrato: si falta una descripción, el proceso ni arranca.

## Carpeta nueva → `docs/00-overview/repo-map.md`

Cualquier carpeta nueva en el árbol (`packages/`, `services/`, `apps/*/src/main/features/`,
etc.) se añade a `repo-map.md` en el mismo cambio que la crea.

## ADR nuevo cuando hay una decisión de arquitectura

Ver el propio [`how-to-add-a-feature.md`](how-to-add-a-feature.md), sección "¿Necesitas
un ADR?": sí, si la feature introduce una dependencia nueva, cambia una frontera, o
elige entre enfoques no obvios. **Se escribe antes del código**, no después.

## Cada error resuelto → `aprendizaje.md`

Formato fijo (ver el propio archivo en la raíz para docenas de ejemplos reales):

```markdown
## AAAA-MM-DD — Título corto del problema

**Contexto:** qué se estaba haciendo.
**Error:** qué falló exactamente.
**Causa:** por qué falló, la razón de fondo, no el síntoma.
**Solución:** qué se hizo para arreglarlo.
**Cómo evitarlo:** qué regla o comprobación evita que vuelva a pasar.
```

Si un error se repite, la entrada existente no era lo bastante clara o no generó una
comprobación automática — se revisa la entrada, no solo el error.

## Changeset con cada cambio de cara al usuario

`pnpm changeset`, describiendo el impacto para quien usa la app o el paquete — no el
detalle técnico de la implementación (eso ya está en el commit y en `decisions.md`).

## Verificación, no suposición

Antes de dar una tarea por cerrada, ejecutar (no asumir):

- Todos los archivos que se dijo que se crearían existen de verdad.
- Todos los enlaces internos de la documentación resuelven a archivos reales.
- El código compila, los tests pasan, los ejemplos de `@example` son correctos.
- No queda ninguna referencia a algo que se borró — `grep -rn "NombreBorrado" .
  --exclude-dir=.git --exclude-dir=node_modules`.

Si algo falla, se reporta con la salida real del comando — "debería estar bien" no es
una verificación.
