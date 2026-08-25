/// <reference types="vite/client" />

// Tipa `window.ycore` en el renderer con la forma exacta que expone el
// preload (ver src/preload/index.ts). Así el renderer nunca puede llamar a un
// canal que no exista en el contrato ni pasarle un input con la forma
// equivocada — el error sale en compilación, no en producción.
import type { YcoreBridge } from '../preload/index.js';

declare global {
  interface Window {
    readonly ycore: YcoreBridge;
  }
}
