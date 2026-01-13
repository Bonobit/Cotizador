import { Injectable } from '@angular/core';

export type CotizacionState = {
  formRaw: any;        // getRawValue() completo (incluye disabled)
  showPlan: boolean;
  cotizacionNo: number;
};

@Injectable({ providedIn: 'root' })
export class CotizacionStateService {
  private state: CotizacionState | null = null;

  setState(s: CotizacionState) {
    this.state = s;
  }

  getState(): CotizacionState | null {
    return this.state;
  }

  clear() {
    this.state = null;
  }
}
