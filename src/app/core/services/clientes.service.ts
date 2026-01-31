import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environments';
import { Cliente, ClientePayload } from '@core/models/cliente.model';

@Injectable({ providedIn: 'root' })
export class ClientesService {
    private baseUrl = environment.supabaseUrl;

    constructor(private http: HttpClient) { }

    createCliente(payload: ClientePayload): Observable<Cliente[]> {
        const url = `${this.baseUrl}/rest/v1/clientes`;
        const headers = new HttpHeaders({
            apikey: environment.supabaseAnonKey,
            Authorization: `Bearer ${environment.supabaseAnonKey}`,
            Prefer: 'return=representation',
        });

        return this.http.post<Cliente[]>(url, payload, { headers });
    }

    getClienteByDocumento(numeroDocumento: string): Observable<Cliente[]> {
        const url = `${this.baseUrl}/rest/v1/clientes?numero_documento=eq.${numeroDocumento}`;
        const headers = new HttpHeaders({
            apikey: environment.supabaseAnonKey,
            Authorization: `Bearer ${environment.supabaseAnonKey}`,
        });
        return this.http.get<Cliente[]>(url, { headers });
    }
}
