import { Injectable } from '@angular/core';
import { CotizacionFormState } from '@core/models/form-state.model';

@Injectable({ providedIn: 'root' })
export class CotizacionStateService {
    private key = 'cotizacion_form_state_v1';

    save(value: CotizacionFormState): void {
        try {
            localStorage.setItem(this.key, JSON.stringify(value));
        } catch (error) {
            console.error('Error saving state to localStorage', error);
        }
    }

    load(): CotizacionFormState | null {
        try {
            const raw = localStorage.getItem(this.key);
            return raw ? (JSON.parse(raw) as CotizacionFormState) : null;
        } catch (error) {
            console.error('Error loading state from localStorage', error);
            return null;
        }
    }

    clear(): void {
        localStorage.removeItem(this.key);
    }
}
