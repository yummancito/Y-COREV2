# Contrato IPC — canales

> **Generado automáticamente desde `packages/ipc-contract`. No editar a mano.**
> Para cambiar esta página, edita el `.describe()` del canal en el contrato y
> vuelve a correr `pnpm --filter @ycore/desktop docs:ipc`.

Cada canal se invoca desde el renderer como `window.ycore.<namespace>.<verbo>(input)`.
Ver ADR-0002 para el diseño completo de la frontera IPC.

## Namespace `app.*`

### `app.ping`

Sin payload: solo confirma que el puente IPC responde.

**Input:**

  (sin campos)

**Output:**

Confirmación de que el main process está vivo y respondiendo.

  - `pong: boolean`
  - `receivedAt: string`

## Namespace `library.*`

### `library.launch`

Lanza un juego instalado.

**Input:**

  - `appId: integer` — AppID del juego a lanzar.

**Output:**

El proceso quedó lanzado.

  - `pid: integer` — PID del proceso lanzado.

### `library.list`

Sin filtros por ahora: devuelve toda la biblioteca conocida.

**Input:**

  (sin campos)

**Output:**

La biblioteca completa.

  - `games: array` — Todos los juegos conocidos.

## Namespace `steam.*`

### `steam.importLibrary`

Sin parámetros: escanea la instalación de Steam de esta máquina.

**Input:**

  (sin campos)

**Output:**

Resultado del escaneo. Los datos ya quedaron guardados; usa library.list para leerlos.

  - `gamesFound: integer` — Cuántos juegos se encontraron instalados.

