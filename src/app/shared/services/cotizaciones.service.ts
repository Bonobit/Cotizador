import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environments';

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

@Injectable({ providedIn: 'root' })
export class CotizacionesService {
  private baseUrl = environment.supabaseUrl;

  constructor(private http: HttpClient) { }

  crearCotizacion(payload: Cotizacion) {
    const url = `${this.baseUrl}/rest/v1/cotizaciones`;

    const headers = new HttpHeaders({
      apikey: environment.supabaseAnonKey,
      Authorization: `Bearer ${environment.supabaseAnonKey}`,
      Prefer: 'return=representation',
    });

    return this.http.post<CotizacionRow[]>(url, payload, { headers });
  }

  getUltimaCotizacion() {
    const url = `${this.baseUrl}/rest/v1/cotizaciones`;
    const headers = new HttpHeaders({
      apikey: environment.supabaseAnonKey,
      Authorization: `Bearer ${environment.supabaseAnonKey}`,
    });

    // Order by serial_id descending, limit 1
    const params = new HttpParams()
      .set('select', 'serial_id')
      .set('order', 'serial_id.desc')
      .set('limit', '1');

    return this.http.get<CotizacionRow[]>(url, { headers, params });
  }
}
