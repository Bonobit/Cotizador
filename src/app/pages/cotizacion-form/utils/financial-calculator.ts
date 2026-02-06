export class FinancialCalculator {
    /**
     * Limpia un string de moneda y lo convierte a número
     */
    static toNum(v: any): number {
        if (v === null || v === undefined || v === '') return 0;
        if (typeof v === 'number') return v;

        let s = String(v).replace(/[^0-9,.-]+/g, "");
        if (s.endsWith(',')) s = s.slice(0, -1);
        s = s.replace(/,/g, "");

        return Number(s) || 0;
    }

    /**
     * Calcula los meses entre hoy y una fecha futura (día 1 del mes siguiente)
     */
    static calcMonths(dateStr: string): number {
        const f = dateStr ? new Date(dateStr) : null;
        if (!f || isNaN(f.getTime())) return 0;

        const start = new Date();
        start.setMonth(start.getMonth() + 1);
        start.setDate(1);

        const months = (f.getFullYear() - start.getFullYear()) * 12 +
            (f.getMonth() - start.getMonth()) + 1;

        return Math.max(months, 0);
    }

    /**
     * Calcula el valor especial hoy (Valor Total - Beneficios)
     */
    static calculateValorEspecial(valorTotal: number, beneficios: number[]): number {
        const totalBeneficios = beneficios.reduce((a, b) => a + b, 0);
        return Math.max(valorTotal - totalBeneficios, 0);
    }

    /**
     * Calcula el valor de la cuota inicial basado en el porcentaje
     */
    static calculateCuotaInicial(valorEspecial: number, porcentaje: number): number {
        return Math.round(valorEspecial * (porcentaje / 100));
    }

    /**
     * Verifica si se excedió el límite de beneficios (15%) para requerir aprobador
     */
    static checkBeneficioExceeded(valorTotal: number, benefValorizacion: number, benefPronta: number): boolean {
        const porcentajeBeneficio = 0.15;
        const maxBeneficio = valorTotal * porcentajeBeneficio;
        return (benefValorizacion + benefPronta) > maxBeneficio;
    }
}
