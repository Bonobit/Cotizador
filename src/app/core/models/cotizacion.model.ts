export interface Cotizacion {
    cliente_id: string | null;
    asesor_id: number | null;
    apartamento_id: string | null;
    snapshot_datos: any;
}

export interface CotizacionRow extends Cotizacion {
    serial_id?: number;
    created_at?: string;
}
