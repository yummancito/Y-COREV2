/**
 * `createMainWindow` — crea la única ventana principal de Y-CORE.
 *
 * Sirve para centralizar los `webPreferences` de seguridad en un solo lugar:
 * `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Son la
 * base de que el preload sea el único puente posible entre renderer y main
 * (ADR-0002) — sin esto, cualquier bridge tipado da igual, porque el renderer
 * tendría acceso directo a Node.
 */

import { join } from 'node:path';
import { BrowserWindow, shell } from 'electron';
import { is } from '@electron-toolkit/utils';

/**
 * @returns La ventana creada, ya con los listeners de navegación externa
 *   (abre `target="_blank"` y enlaces externos en el navegador del SO, nunca
 *   dentro de la app).
 */
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.on('ready-to-show', () => window.show());

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void window.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return window;
}
