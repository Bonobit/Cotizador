import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { LoggerService } from '../services/logger.service';

/**
 * Interceptor HTTP que captura y maneja todos los errores HTTP de forma centralizada
 * 
 * ¿Qué hace?
 * - Intercepta automáticamente todas las peticiones HTTP
 * - Si hay un error, lo registra con detalles útiles
 * - Podría mostrar mensajes al usuario, enviarerrors a Sentry, etc.
 * 
 * Beneficios:
 * - Evita repetir código de manejo de errores en cada servicio
 * - Logging consistente de todos los errores HTTP
 * - Fácil de extender para añadir retry logic, notificaciones, etc.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
    const logger = inject(LoggerService);

    return next(req).pipe(
        catchError((error: HttpErrorResponse) => {
            let errorMessage = '';

            if (error.error instanceof ErrorEvent) {
                // Error del lado del cliente (red, navegador, etc.)
                errorMessage = `Error del cliente: ${error.error.message}`;
            } else {
                // Error del lado del servidor (API, backend)
                errorMessage = `Error ${error.status}: ${error.message}`;

                // Log específico para errores 404, 401, 500, etc.
                if (error.status === 401) {
                    logger.error('No autorizado - Verifica las credenciales de Supabase');
                } else if (error.status === 404) {
                    logger.error('Recurso no encontrado', error.url);
                } else if (error.status === 500) {
                    logger.error('Error interno del servidor');
                }
            }

            // Log del error completo
            logger.error(errorMessage, error);

            // Re-lanzar el error para que el que hizo la petición también lo maneje si quiere
            return throwError(() => error);
        })
    );
};
