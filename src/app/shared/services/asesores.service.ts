import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface Asesor {
  id: number;
  nombre_completo: string;
  telefono: string;
  email: string;
  activo: boolean;
  link_img: string;
}

@Injectable({ providedIn: 'root' })
export class AsesoresService {
  private baseUrl = environment.supabaseUrl;

  constructor(private http: HttpClient) { }

  getAsesoresActivos(): Observable<Asesor[]> {
    const url = `${this.baseUrl}/rest/v1/asesores`;

    const params = new HttpParams()
      .set('select', 'id,nombre_completo,telefono,email,activo,link_img')
      .set('activo', 'eq.true')
      .set('order', 'nombre_completo.asc');

    const headers = new HttpHeaders({
      apikey: environment.supabaseAnonKey,
      Authorization: `Bearer ${environment.supabaseAnonKey}`,
    });

    return this.http.get<Asesor[]>(url, { headers, params });
  }
}
