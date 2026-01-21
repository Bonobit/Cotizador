import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CotizacionStateService {
    private key = 'cotizacion_form_state_v1';

    save(value: any) {
        localStorage.setItem(this.key, JSON.stringify(value));
    }

    load<T = any>(): T | null {
        const raw = localStorage.getItem(this.key);
        return raw ? (JSON.parse(raw) as T) : null;
    }

    clear() {
        localStorage.removeItem(this.key);
    }
}
