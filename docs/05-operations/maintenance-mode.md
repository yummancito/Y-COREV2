# Modo mantenimiento

Permite **pausar las actualizaciones de todos los clientes** sin que ninguno se entere.
Lo activas tú, y mientras esté activo nadie recibe updates. Al desactivarlo, vuelven a
recibirlos en su siguiente comprobación.

## Cómo funciona (y por qué así)

En mantenimiento, el Worker responde a `GET /v1/check` **exactamente** lo mismo que
responde a alguien que ya está al día:

```json
{ "status": "up-to-date", "checkAgainInSeconds": 21600 }
```

El cliente **no puede distinguir** "hay mantenimiento" de "estás en la última versión".
No existe un estado "en mantenimiento" en el cliente, ni un mensaje que mostrar, ni una
rama de código que pueda fallar.

Esa indistinguibilidad es deliberada:

- **Cero ruido para el usuario.** No hay popup, ni banner, ni error. La app se comporta
  con normalidad absoluta.
- **Cero superficie de bug.** Un estado que no existe no se puede quedar pegado ni
  renderizar mal.
- **No filtra información.** Nadie sabe cuándo estás tocando el backend.

## Comandos

```bash
ycore maintenance on --note "migrando binarios a R2"
ycore maintenance status
ycore maintenance off
```

`--note` es para ti: queda en la tabla `maintenance_log` de D1 junto con quién y cuándo.
No se envía nunca a los clientes.

## Cuándo usarlo

- Antes de tocar el bucket de R2, el esquema de D1 o el propio Worker.
- Mientras investigas un incidente y no quieres que más gente actualice.
- Si has publicado algo y dudas: mantenimiento primero, investigar después.

Para retirar una versión concreta **no uses mantenimiento** — eso es `yank` o `block`,
ver [incident-playbook.md](incident-playbook.md). Mantenimiento es un interruptor global.

## Qué pasa exactamente al activarlo

1. El comando escribe `maintenance.enabled = true` en el KV `YCORE_CONFIG`.
2. La propagación por el edge de Cloudflare tarda **hasta ~60 segundos**.
3. Los clientes que comprueben a partir de ese momento reciben `up-to-date`.
4. **Un cliente que ya estaba descargando termina su descarga.** Mantenimiento no cancela
   descargas en curso; solo impide que empiecen nuevas.

Ese punto 4 importa: si necesitas que nadie complete una actualización concreta, usa
`ycore release yank` sobre esa versión además del mantenimiento.

## Qué pasa al desactivarlo

Nada inmediato. Cada cliente lo descubre en su siguiente comprobación, que ocurre como
mucho `checkAgainInSeconds` después (6 h por defecto). No hay push.

Si necesitas que la gente actualice ya, baja `checkIntervalSeconds` en el KV **antes** de
publicar, no después.

## Verificación

Después de activar o desactivar, compruébalo de verdad, no te fíes del comando:

```bash
ycore maintenance status

# y contra el endpoint real, simulando un cliente desactualizado:
curl "https://updates.y-core.app/v1/check?version=1.0.0&channel=stable&platform=win32&arch=x64&clientId=test"
```

Con mantenimiento activo debe devolver `up-to-date` **aunque la versión consultada sea
antigua**. Si devuelve `update-available`, el flag no se ha propagado todavía: espera un
minuto y repite.
