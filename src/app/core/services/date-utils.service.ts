import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class DateUtilsService {

    constructor() { }

    /**
     * Calcula el número de meses desde el próximo mes hasta la fecha dada.
     * Retorna null si la fecha es inválida.
     * Retorna 0 si la fecha dada es anterior al próximo mes.
     */
    calcMonths(dateStr: string): number | null {
        const f = dateStr ? new Date(dateStr) : null;
        if (!f || isNaN(f.getTime())) return null;

        const start = new Date();
        start.setMonth(start.getMonth() + 1);
        start.setDate(1);

        // Normalizar la fecha fin para evitar problemas con días
        // Aunque la lógica original no lo hacía explícitamente, 
        // al comparar meses completos es mejor ignorar días y horas.
        // Sin embargo, mantendré la lógica original exacta para minimizar riesgos.

        // Original logic:
        // (f.getFullYear() - start.getFullYear()) * 12 + (f.getMonth() - start.getMonth()) + 1;

        const months = (f.getFullYear() - start.getFullYear()) * 12 +
            (f.getMonth() - start.getMonth()) + 1;

        return Math.max(months, 0);
    }
}
