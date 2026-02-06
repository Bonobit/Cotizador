import { FormGroup } from '@angular/forms';

export const FIELD_LABELS: Record<string, string> = {
    tipoDocumento: 'Tipo documento',
    noDocumento: 'Número de documento',
    nombres: 'Nombres',
    apellidos: 'Apellidos',
    direccion: 'Dirección',
    telefono: 'Teléfono',
    correo: 'Correo',
    canal: 'Canal',
    proyecto: 'Proyecto',
    torre: 'Torre',
    apartamento: 'Apartamento',
    valorTotal: 'Valor total',
    fechaUltimaCuota: 'Fecha última cuota',
    cotizacionValidaHasta: 'Cotización válida hasta',
    nombreEjecutivo: 'Nombre del ejecutivo',
    telefonoEjecutivo: 'Teléfono del ejecutivo',
    correoEjecutivo: 'Correo del ejecutivo',
};

export function getCotizacionErrorMessage(form: FormGroup, controlName: string): string {
    const c = form.get(controlName);
    if (!c) return '';

    const label = (FIELD_LABELS[controlName] ?? controlName).toLowerCase();

    if (c.hasError('required')) {
        return `El campo "${label}" es requerido.`;
    }
    if (c.hasError('email')) {
        return `El campo "${label}" debe ser un correo válido.`;
    }
    if (c.hasError('maxlength')) {
        const req = c.getError('maxlength')?.requiredLength;
        return `El campo "${label}" debe tener máximo ${req} caracteres.`;
    }
    if (c.hasError('minlength')) {
        const req = c.getError('minlength')?.requiredLength;
        return `El campo "${label}" debe tener mínimo ${req} caracteres.`;
    }
    if (c.hasError('pattern')) {
        return `El campo "${label}" tiene un formato inválido.`;
    }
    if (c.hasError('min')) {
        const min = c.getError('min')?.min;
        return `El campo "${label}" debe ser mayor o igual a ${min}.`;
    }
    if (c.hasError('max')) {
        const max = c.getError('max')?.max;
        return `El campo "${label}" debe ser menor o igual a ${max}.`;
    }
    if (c.hasError('benefitsExceeded')) {
        return `La suma de beneficios excede el 50% del valor total.`;
    }

    return `El campo "${label}" es inválido.`;
}
