# Biblioteca — recorridos de usuario

## Ver la biblioteca

1. La app arranca, `App` monta `LibraryGrid`.
2. `useLibraryQuery` llama `window.ycore.library.list({})`.
3. Mientras responde: `LibraryGrid` muestra "Cargando biblioteca…".
4. Si la biblioteca está vacía: "No hay juegos en la biblioteca todavía."
5. Si hay juegos: una `GameCard` por cada uno, mostrando nombre y estado
   (Instalado / No instalado).
6. Si `window.ycore.library.list` devuelve un `AppError`: "No se pudo cargar la
   biblioteca: `<código del error>`."

## Lanzar un juego

1. En una `GameCard` de un juego instalado con `executablePath` resuelto, el botón
   "Jugar" está habilitado.
2. Clic en "Jugar" → `useLaunchGame().mutate(appId)` → `window.ycore.library.launch({ appId })`.
3. Mientras se lanza: el botón de esa tarjeta cambia a "Lanzando…" y se deshabilita
   (`launch.isPending && launch.variables === game.appId` — solo esa tarjeta, no todas).
4. Si el lanzamiento fracasa (`AppError`), la mutación queda en estado de error; hoy no
   hay feedback visual del error en la tarjeta (pendiente: mostrar el código del error
   junto al botón cuando `launch.isError` sea true para ese `appId`).

## Casos deshabilitados

- Juego sin `installation` (no instalado): botón "Jugar" deshabilitado, texto "No
  instalado".
- Juego con `installation` pero `executablePath: null` (instalado pero sin ejecutable
  resuelto, ver `decisions.md`): botón "Jugar" deshabilitado igual que si no estuviera
  instalado — el usuario no puede distinguir hoy entre "no instalado" y "instalado pero
  sin resolver" solo mirando la tarjeta (pendiente de Fase 3, cuando `steam-kit` resuelva
  `executablePath` de verdad).
