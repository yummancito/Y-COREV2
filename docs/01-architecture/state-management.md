# Gestión de estado: zustand vs TanStack Query

Regla de una sola frase, de la sección A.3 del roadmap: **si el dato viene del main
process, va en TanStack Query. zustand es solo para estado de UI.**

## Por qué esta separación existe

El v1 acabó con `useLibraryStore` + `useLibraryV2Store`: dos fuentes de verdad para el
mismo dato (la biblioteca de juegos), que se desincronizaban. La causa raíz era meter
datos que vienen del backend dentro de zustand, con su propia lógica de refresco
ad-hoc, en vez de dejar que una única capa de datos del servidor (TanStack Query) fuera
la fuente de verdad.

## TanStack Query — todo lo que sale de `window.ycore`

Cada feature del renderer tiene sus hooks en `hooks/use-<algo>.ts`:

- **Queries** (`useLibraryQuery`, `useDownloadsQuery`, `useUpdateStatusQuery`): leen un
  canal `<feature>.list`/`.getStatus` con `useQuery`. Como este repo no tiene todavía
  ningún patrón main→renderer push (solo invoke/handle, ADR-0002), el progreso que
  cambia solo (bytes descargados, fase de actualización) se lee por **polling**
  (`refetchInterval`) mientras haya actividad — ver `docs/02-features/downloads/decisions.md`
  y `docs/02-features/updates/decisions.md` para el detalle de cada intervalo.
- **Mutaciones** (`useLaunchGame`, `useEnqueueDownload`, `usePauseDownload`,
  `useCancelDownload`, `useInstallUpdate`): llaman a un canal `<feature>.<verbo>` con
  `useMutation`. Las que cambian un dato que otra query también lee invalidan esa
  query en `onSuccess` (p. ej. `usePauseDownload` invalida `downloads.list`), así la UI
  refleja el cambio de inmediato sin esperar al siguiente tick de polling.

Ningún hook guarda el resultado en zustand ni en estado de componente persistente:
`useQuery`/`useMutation` son la única fuente de verdad para datos del main.

## zustand — reservado para estado de UI puro

**Hoy, ningún store de zustand existe todavía en el código** (`create()` de zustand no
aparece en `apps/desktop/src/renderer`) — no hay filtros, selección múltiple, ni
pestañas que necesiten estado compartido entre componentes todavía. La dependencia y la
regla están fijadas para cuando aparezca ese caso: filtros de la biblioteca, qué fila
está seleccionada, qué pestaña/vista está abierta. Nunca un dato que también podría
pedirse con `window.ycore`.

## Cómo distinguir un caso del otro

Pregunta de una línea: **¿este dato existe si cierro y reabro la app sin tocar
nada?** Si sí (la lista de juegos, el estado de una descarga, si hay una actualización
disponible), viene del main y va en TanStack Query. Si no (qué filtro tengo activo
ahora mismo, qué modal está abierto), es estado de UI efímero y va en zustand.
