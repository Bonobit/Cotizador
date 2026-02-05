
export interface AdicionalConfig {
   
    id: string;
    displayName: string;
    hasQuantity: boolean;

    formControls: {
        checkbox: string;           // ej: 'parqueadero'
        cantidad?: string;           // ej: 'cantidadParqueaderos' (opcional)
        valorTotal: string;          // ej: 'valorTotalParqueaderos'
        beneficio: string;           // ej: 'beneficioParqueadero'
        valorCuota: string;          // ej: 'valorCuotaParqueadero'
        fechaUltimaCuota: string;    // ej: 'fechaUltimaCuotaParqueadero'
        cuotasFinanciacion: string;  // ej: 'cuotasFinanciacionParqueadero'
    };
}
