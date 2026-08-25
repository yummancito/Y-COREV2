/**
 * `enforceSingleInstance` y `attachLifecycleHandlers` — ciclo de vida del proceso.
 *
 * Sirve para que Y-CORE no permita dos instancias corriendo a la vez (dos
 * gestores de descargas escribiendo la misma DB SQLite sería el bug clásico), y
 * para que la app se cierre de verdad en Windows cuando se cierra la última
 * ventana (a diferencia de macOS, donde una app sigue viva sin ventanas).
 */

import { app, BrowserWindow } from 'electron';
import { createLogger } from '@ycore/logger';

const log = createLogger('main:bootstrap:lifecycle');

/**
 * Pide el lock de instancia única. Si ya hay otra instancia corriendo, esta
 * termina inmediatamente en vez de arrancar una segunda.
 *
 * @returns `true` si esta instancia obtuvo el lock y debe continuar arrancando;
 *   `false` si ya había otra instancia y el llamador debe salir sin hacer nada más.
 */
export function enforceSingleInstance(onSecondInstance: () => void): boolean {
  const gotLock = app.requestSingleInstanceLock();

  if (!gotLock) {
    log.warn('ya hay una instancia de Y-CORE corriendo, cerrando esta');
    return false;
  }

  app.on('second-instance', () => {
    log.info('segunda instancia detectada, enfocando la ventana existente');
    onSecondInstance();
  });

  return true;
}

/**
 * Conecta los eventos de ciclo de vida estándar de Electron al `createWindow`
 * dado. Windows-only (ver .claude/CLAUDE.md): no hay rama especial para macOS
 * (dock, reactivación sin ventanas).
 */
export function attachLifecycleHandlers(createWindow: () => BrowserWindow): void {
  app.on('window-all-closed', () => {
    log.info('todas las ventanas cerradas, saliendo');
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
