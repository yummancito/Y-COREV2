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

## Namespace `downloads.*`

### `downloads.cancel`

Cancela y borra una descarga.

**Input:**

  - `id: string` — Id de la descarga a cancelar.

**Output:**

La descarga y su archivo parcial quedaron borrados.

  (sin campos)

### `downloads.enqueue`

Encola una descarga nueva.

**Input:**

  - `appId: integer` — AppID del juego a descargar.
  - `sourceUrl: string` — De dónde descargar el archivo.
  - `installPath: string` — Dónde extraer/instalar tras verificar.
  - `expectedSha256: string` — Hash SHA-256 esperado del archivo, en hexadecimal.

**Output:**

La descarga quedó encolada (estado queued).

  - `id: string` — Id de la descarga encolada.

### `downloads.list`

Sin filtros por ahora: devuelve toda la cola de descargas.

**Input:**

  (sin campos)

**Output:**

La cola completa. El renderer hace polling de este canal para ver el progreso.

  - `downloads: array` — Todas las descargas conocidas.

### `downloads.pause`

Pausa una descarga en curso.

**Input:**

  - `id: string` — Id de la descarga a pausar.

**Output:**

La descarga quedó pausada.

  (sin campos)

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

## Namespace `updates.*`

### `updates.getStatus`

Sin filtros: devuelve el estado actual del ciclo de actualización.

**Input:**

  (sin campos)

**Output:**

El estado actual, para que el renderer haga polling.

  - `status: unknown` — Estado actual del ciclo de actualización, tal como lo ve el renderer. No existe un estado "en mantenimiento": el Worker lo hace indistinguible de up-to-date (ADR-0003).

### `updates.installNow`

Instala la actualización ya descargada y verificada (fase ready-to-install) y cierra la app.

**Input:**

  (sin campos)

**Output:**

La instalación se lanzó; la app va a cerrarse.

  (sin campos)

