/**
 * Configuración de un tipo de adicional
 */
export interface AdicionalConfig {
    /** Identificador único del adicional (ej: 'parqueadero', 'kitAcabados') */
    id: string;

    /** Nombre a mostrar en la UI (ej: 'Parqueadero', 'Kit de Acabados') */
    displayName: string;

    /** Si este adicional tiene selector de cantidad */
    hasQuantity: boolean;

    /** Nombres de los controles del formulario para este adicional */
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
