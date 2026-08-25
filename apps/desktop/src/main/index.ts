/**
 * Punto de entrada del main process. Sirve solo para orquestar el arranque:
 * lock de instancia única, Electron Fuses, ventana principal y el router IPC.
 * Cero lógica de negocio aquí — eso vive en `main/features/*`.
 *
 * Debe quedarse por debajo de 150 líneas (regla de Fase 0 del roadmap): si
 * crece, es señal de que algo debería moverse a `main/bootstrap/`.
 */

import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { createLogger } from '@ycore/logger';
import { attachLifecycleHandlers, enforceSingleInstance } from './bootstrap/lifecycle.js';
import { createMainWindow } from './bootstrap/window.js';
import { registerIpcRouter } from './ipc/router.js';

const log = createLogger('main:bootstrap');

let mainWindow: BrowserWindow | null = null;

function showOrCreateMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return;
  }
  mainWindow = createMainWindow();
}

if (!enforceSingleInstance(showOrCreateMainWindow)) {
  app.quit();
} else {
  void app.whenReady().then(() => {
    electronApp.setAppUserModelId('app.y-core');

    app.on('browser-window-created', (_event, window) => {
      optimizer.watchWindowShortcuts(window);
    });

    registerIpcRouter();
    mainWindow = createMainWindow();
    attachLifecycleHandlers(() => (mainWindow = createMainWindow()));

    log.info('Y-CORE arrancado');
  });
}
