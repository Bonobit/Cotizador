import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Proyectos } from '@core/models/proyecto.model';

@Injectable({ providedIn: 'root' })
export class ProyectosService {
    private baseUrl = environment.supabaseUrl;

    constructor(private http: HttpClient) { }

    getProyectosActivos(): Observable<Proyectos[]> {
        const url = `${this.baseUrl}/rest/v1/proyectos`;

        const params = new HttpParams()
            .set('select', 'id,nombre,logo_url,link_recorrido_360')
            .set('order', 'id.asc');

        const headers = new HttpHeaders({
            apikey: environment.supabaseAnonKey,
            Authorization: `Bearer ${environment.supabaseAnonKey}`,
        });

        return this.http.get<Proyectos[]>(url, { headers, params });
    }
}
