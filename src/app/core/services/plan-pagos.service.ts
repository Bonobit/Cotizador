import { Injectable } from '@angular/core';

export interface PlanPagosOpciones {
    valorTotal: number;
    valorInicial?: number;  // Opcional, por defecto 0
    cantidadCuotas: number;
    fechaUltimaCuota: string;
    valorCuotaManual?: number; // Opcional, si se provee se usa este valor
}

export interface PlanPagosItem {
    fecha: string;
    valor: number;
}

@Injectable({
    providedIn: 'root'
})
export class PlanPagosService {

    constructor() { }

    /**
     * Calcula las fechas de las cuotas desde la fecha final hacia atrás
     * @param cantidad Número de cuotas
     * @param fechaUltima Fecha de la última cuota en formato 'YYYY-MM-DD'
     * @returns Array de fechas en formato 'YYYY-MM-DD'
     */
    calcularFechas(cantidad: number, fechaUltima: string): string[] {
        if (!cantidad || !fechaUltima) return [];

        const dates: string[] = [];
        // Parsear fecha 'YYYY-MM-DD'
        const parts = fechaUltima.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Mes 0-indexed
        const day = parseInt(parts[2], 10);

        for (let i = 0; i < cantidad; i++) {
            const monthsToSubtract = cantidad - 1 - i;
            const d = new Date(year, month - monthsToSubtract, 1);
            const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const finalDay = Math.min(day, maxDays);

            d.setDate(finalDay);

            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');

            dates.push(`${y}-${m}-${da}`);
        }
        return dates;
    }

    /**
     * Calcula el valor mensual de cada cuota
     * @param valorTotal Valor total a financiar
     * @param valorInicial Valor inicial/enganche (opcional)
     * @param cantidadCuotas Número de cuotas
     * @returns Valor mensual redondeado
     */
    calcularValorMensual(valorTotal: number, valorInicial: number = 0, cantidadCuotas: number): number {
        if (cantidadCuotas <= 0) return 0;
        return Math.round((valorTotal - valorInicial) / cantidadCuotas);
    }

    /**
     * Genera un plan de pagos completo
     * @param opciones Configuración del plan de pagos
     * @returns Array de items con fecha y valor de cada cuota
     */
    generarPlanPagos(opciones: PlanPagosOpciones): PlanPagosItem[] {
        const { valorTotal, valorInicial = 0, cantidadCuotas, fechaUltimaCuota, valorCuotaManual } = opciones;

        // Calcular fechas
        const fechas = this.calcularFechas(cantidadCuotas, fechaUltimaCuota);

        // Calcular valor mensual (o usar el manual si existe)
        const valorMensual = valorCuotaManual !== undefined
            ? valorCuotaManual
            : this.calcularValorMensual(valorTotal, valorInicial, cantidadCuotas);

        // Generar items del plan
        const plan: PlanPagosItem[] = fechas.map(fecha => ({
            fecha,
            valor: valorMensual
        }));

        return plan;
    }

    /**
     * Recalcula las cuotas distribuyendo el saldo restante entre las cuotas no manuales.
     * @param totalFinanciar Valor total que deben sumar todas las cuotas
     * @param cuotas Estado actual de las cuotas (valor actual y si fue editada manualmente)
     * @param valorMinimo Valor mínimo permitido para cualquier cuota
     */
    recalcularCuotas(
        totalFinanciar: number,
        cuotas: { valor: number; manual: boolean }[],
        valorMinimo: number
    ): { success: boolean; nuevosValores?: number[]; error?: string } {
        // 1. Sumar valores de cuotas manuales
        const totalManual = cuotas
            .filter(c => c.manual)
            .reduce((sum, c) => sum + c.valor, 0);

        // 2. Calcular saldo restante para cuotas automáticas
        const saldoRestante = totalFinanciar - totalManual;
        const countAutomaticas = cuotas.filter(c => !c.manual).length;

        // Caso borde: Si no hay automáticas (todas manuales)
        if (countAutomaticas === 0) {
            if (saldoRestante !== 0) {
                return { success: false, error: 'La suma de las cuotas manuales no coincide con el total.' };
            }
            return { success: true, nuevosValores: cuotas.map(c => c.valor) };
        }

        // 3. Calcular nuevo valor para automáticas
        // Usamos Math.floor para evitar decimales y sumamos el residuo a la última automática
        let valorAutomatico = Math.floor(saldoRestante / countAutomaticas);

        // 4. Validar mínimo
        if (valorAutomatico < valorMinimo) {
            return {
                success: false,
                error: `El recálculo genera cuotas automáticas de $${valorAutomatico.toLocaleString()}, que es menor al mínimo permitido de $${valorMinimo.toLocaleString()}.`
            };
        }

        // 5. Generar array con nuevos valores
        const nuevosValores: number[] = [];
        let acumuladoAutomaticas = 0;
        let automáticasProcesadas = 0;

        for (let i = 0; i < cuotas.length; i++) {
            if (cuotas[i].manual) {
                nuevosValores.push(cuotas[i].valor);
            } else {
                automáticasProcesadas++;
                // Si es la última automática, le sumamos cualquier residuo por redondeo
                if (automáticasProcesadas === countAutomaticas) {
                    const residuo = saldoRestante - acumuladoAutomaticas;
                    nuevosValores.push(residuo); // El residuo debería ser aprox igual a valorAutomatico
                } else {
                    nuevosValores.push(valorAutomatico);
                    acumuladoAutomaticas += valorAutomatico;
                }
            }
        }

        // Validación final de mínimos para el residuo (por si acaso el residuo quedó muy bajo, aunque matemático deberia ser mayor o igual)
        if (nuevosValores.some(v => v < valorMinimo)) {
            return {
                success: false,
                error: `Una cuota quedó por debajo del mínimo permitido.`
            };
        }

        return { success: true, nuevosValores };
    }
}
