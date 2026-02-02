import { Injectable } from '@angular/core';

export interface CalculosCotizacion {
    maxBeneficio: number;
    totalBeneficios: number;
    beneficiosExcedidos: boolean;
    valorEspecial: number;
    valorCuotaInicial: number;
}

@Injectable({
    providedIn: 'root'
})
export class CotizacionCalculadoraService {

    private readonly PORCENTAJE_BENEFICIO_MAXIMO = 0.15;

    constructor() { }

    calcular(
        valorTotal: number,
        beneficioValorizacion: number,
        beneficioProntaSeparacion: number,
        porcentajeCuotaInicial: number
    ): CalculosCotizacion {
        const vt = this.toNum(valorTotal);
        const bv = this.toNum(beneficioValorizacion);
        const bp = this.toNum(beneficioProntaSeparacion);
        const p = this.toNum(porcentajeCuotaInicial);

        const maxBeneficio = vt * this.PORCENTAJE_BENEFICIO_MAXIMO;
        const totalBeneficios = bv + bp;
        const beneficiosExcedidos = totalBeneficios > maxBeneficio;

        const valorEspecial = Math.max(vt - bv - bp, 0);
        const valorCuotaInicial = Math.round(valorEspecial * (p / 100));

        return {
            maxBeneficio,
            totalBeneficios,
            beneficiosExcedidos,
            valorEspecial,
            valorCuotaInicial
        };
    }

    private toNum(v: any): number {
        return (v === null || v === undefined || v === '') ? 0 : Number(v) || 0;
    }
}
