/**
 * Representa un cliente en la base de datos
 */
export interface Cliente {
    id?: string;
    numero_documento: string;
    tipo_documento: string;
    nombres: string;
    apellidos: string;
    direccion: string;
    telefono: string;
    email: string;
    created_at?: string;
}

/**
 * Payload para crear un nuevo cliente
 */
export interface ClientePayload {
    numero_documento: string;
    tipo_documento: string;
    nombres: string;
    apellidos: string;
    direccion: string;
    telefono: string;
    email: string;
}
