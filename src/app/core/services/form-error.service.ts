import { Injectable } from '@angular/core';
import { AbstractControl } from '@angular/forms';

@Injectable({
    providedIn: 'root'
})
export class FormErrorService {

    getErrorMessage(control: AbstractControl | null, label: string): string {
        if (!control) return '';

        // Si el control es válido o no ha sido tocado/modificado, 
        // generalmente no mostramos error, pero la lógica de visualización 
        // suele estar en el template (control.invalid && (control.dirty || control.touched)).
        // Aquí solo devolvemos el mensaje dado el estado del error.

        const labelLowerCase = label.toLowerCase();

        if (control.hasError('required')) {
            return `El campo "${labelLowerCase}" es requerido.`;
        }

        if (control.hasError('email')) {
            return `El campo "${labelLowerCase}" debe ser un correo válido.`;
        }

        if (control.hasError('maxlength')) {
            const req = control.getError('maxlength')?.requiredLength;
            return `El campo "${labelLowerCase}" debe tener máximo ${req} caracteres.`;
        }

        if (control.hasError('minlength')) {
            const req = control.getError('minlength')?.requiredLength;
            return `El campo "${labelLowerCase}" debe tener mínimo ${req} caracteres.`;
        }

        if (control.hasError('pattern')) {
            return `El campo "${labelLowerCase}" tiene un formato inválido.`;
        }

        if (control.hasError('min')) {
            const min = control.getError('min')?.min;
            return `El campo "${labelLowerCase}" debe ser mayor o igual a ${min}.`;
        }

        if (control.hasError('max')) {
            const max = control.getError('max')?.max;
            return `El campo "${labelLowerCase}" debe ser menor o igual a ${max}.`;
        }

        if (control.hasError('benefitsExceeded')) {
            return `La suma de beneficios excede el 50% del valor total.`;
        }

        // Default generic error
        if (control.errors) {
            return `El campo "${labelLowerCase}" es inválido.`;
        }

        return '';
    }
}
