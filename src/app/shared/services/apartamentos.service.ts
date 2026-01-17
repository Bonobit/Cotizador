import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';

export interface Apartamentos {
  id: string; // uuid
  proyecto_id: number;
  torre: string;
  numero_apto: string;
  area_total: number | null;
  precio_lista: number | null;
  fecha_entrega: string | null; // date string
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class ApartamentosService {
  private baseUrl = environment.supabaseUrl;

  constructor(private http: HttpClient) { }

  getApartamentosByProyecto(proyectoId: number): Observable<Apartamentos[]> {
    const url = `${this.baseUrl}/rest/v1/apartamentos`;

    const params = new HttpParams()
      .set('select', 'id,proyecto_id,torre,numero_apto,area_total,precio_lista,fecha_entrega,estado')
      .set('proyecto_id', `eq.${proyectoId}`)
      .set('estado', 'eq.DISPONIBLE')
      .set('order', 'torre.asc,numero_apto.asc');

    const headers = new HttpHeaders({
      apikey: environment.supabaseAnonKey,
      Authorization: `Bearer ${environment.supabaseAnonKey}`,
    });

    return this.http.get<Apartamentos[]>(url, { headers, params });
  }

}
