/**
 * Interfaz que representa el estado completo del formulario de cotización
 * Esta interfaz se usa para persistir y cargar el estado del formulario
 */
export interface CotizacionFormState {
    // ==== DATOS DEL CLIENTE ====
    tipoDocumento: string;
    noDocumento: string;
    nombres: string;
    apellidos: string;
    direccion: string;
    telefono: string;
    correo: string;
    canal: string;

    // ==== DATOS DEL APARTAMENTO ====
    proyecto: number | null;
    torre: string;
    apartamento_id: string | null;
    apartamento: string;
    valorTotal: number | null;

    // ==== BENEFICIOS ====
    beneficioValorizacion: number;
    conceptoBeneficioValorizacion: string;
    beneficioProntaSeparacion: number;
    conceptoBeneficioProntaSeparacion: string;
    valorEspecialHoy: number | null;

    // ==== CUOTA INICIAL ====
    porcentajeCuotaInicial: number;
    valorCuotaInicial: number | null;

    // ==== FINANCIACIÓN ====
    fechaUltimaCuota: string;
    cantidadCuotas: number;

    // ==== ADICIONALES - PARQUEADERO ====
    parqueadero: boolean;
    cantidadParqueaderos?: string;
    valorTotalParqueaderos?: number;
    beneficioParqueadero?: number;
    valorCuotaParqueadero?: number;
    fechaUltimaCuotaParqueadero?: string;
    cuotasFinanciacionParqueadero?: number;

    // ==== ADICIONALES - KIT ACABADOS ====
    kitAcabados: boolean;
    valorTotalKitAcabados?: number;
    beneficioKitAcabados?: number;
    valorCuotaKitAcabados?: number;
    fechaUltimaCuotaKitAcabados?: string;
    cuotasFinanciacionKitAcabados?: number;

    // ==== ADICIONALES - KIT DOMÓTICA ====
    kitDomotica: boolean;
    valorTotalKitDomotica?: number;
    beneficioKitDomotica?: number;
    valorCuotaKitDomotica?: number;
    fechaUltimaCuotaKitDomotica?: string;
    cuotasFinanciacionKitDomotica?: number;

    // ==== ADICIONALES - DEPÓSITO ====
    deposito: boolean;
    valorTotalDeposito?: number;
    beneficioDeposito?: number;
    valorCuotaDeposito?: number;
    fechaUltimaCuotaDeposito?: string;
    cuotasFinanciacionDeposito?: number;

    // ==== EJECUTIVO/ASESOR ====
    nombreEjecutivo: number | null;
    telefonoEjecutivo: string;
    correoEjecutivo: string;
    aprobador: string;

    // ==== OPCIONES ====
    conceptoCiudadViva: boolean;
    actividadesProyecto: boolean;
    link360: boolean;
    cotizacionDolares: boolean;
    cotizacionValidaHasta: string;

    // ==== PLAN DE PAGOS ====
    plan: PlanPagoItem[];

    // ==== CAMPOS CALCULADOS/ADICIONALES ====
    // Estos campos pueden ser calculados dinámicamente o asignados después
    valorCuotaMensualReal?: number;
    valorCuotaLineaProducto?: number;

    // Campos para adicionales agregados
    cuotasFinanciacion?: number;
    valorTotalAdicionales?: number;
    fechaUltimaCuotaAdic?: string;

    // Campos de cotización en dólares
    valorInversionDolares?: number;
    cuotaSeparacionDolares?: number;
    valorCuotaInicialDolares?: number;
    valorFinalDolares?: number;
    valorCuotaMensualDolares?: number;

    // Campos de financiación bancaria
    valorFinanciacion?: number;
    tasaInteresAnual?: number;
    anosFinanciamiento?: number;
    cuotaBancariaEstimada?: number;

    // Campos de valorización
    valorizacionM2?: number;
    valorizacionEntrega?: number;

    // Campos de retorno de inversión
    tir?: number;
    retorno?: number;
}

/**
 * Representa un item del plan de pagos
 */
export interface PlanPagoItem {
    fechaApto?: string;
    valorApto?: number;
    fechaAdic?: string;
    valorAdic?: number;
}
