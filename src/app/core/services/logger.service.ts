import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environments';

@Injectable({ providedIn: 'root' })
export class LoggerService {
    /**
     * Log informativo - solo visible en desarrollo
     */
    log(message: string, ...args: any[]): void {
        if (!environment.production) {
            console.log(`[LOG] ${message}`, ...args);
        }
    }

    /**
     * Log de error - visible siempre, podría enviarse a servicio de monitoring
     */
    error(message: string, error?: any): void {
        if (!environment.production) {
            console.error(`[ERROR] ${message}`, error);
        } else {
            // TODO: En producción, enviar a servicio de monitoring (Sentry, LogRocket, etc.)
            console.error(`[ERROR] ${message}`, error);
        }
    }

    /**
     * Log de advertencia - visible siempre
     */
    warn(message: string, ...args: any[]): void {
        if (!environment.production) {
            console.warn(`[WARN] ${message}`, ...args);
        } else {
            console.warn(`[WARN] ${message}`, ...args);
        }
    }

    /**
     * Log de depuración - solo visible en desarrollo
     */
    debug(message: string, ...args: any[]): void {
        if (!environment.production) {
            console.debug(`[DEBUG] ${message}`, ...args);
        }
    }
}
