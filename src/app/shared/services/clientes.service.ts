import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from '../../../environments/environments';

@Injectable({ providedIn: 'root' })
export class ClientesService {
    private baseUrl = environment.supabaseUrl;

    constructor(private http: HttpClient) { }

    createCliente(payload: any) {
        const url = `${this.baseUrl}/rest/v1/clientes`;
        const headers = new HttpHeaders({
            apikey: environment.supabaseAnonKey,
            Authorization: `Bearer ${environment.supabaseAnonKey}`,
            Prefer: 'return=representation',
        });

        return this.http.post(url, payload, { headers });
    }

    getClienteByDocumento(numeroDocumento: string) {
        const url = `${this.baseUrl}/rest/v1/clientes?numero_documento=eq.${numeroDocumento}`;
        const headers = new HttpHeaders({
            apikey: environment.supabaseAnonKey,
            Authorization: `Bearer ${environment.supabaseAnonKey}`,
        });
        return this.http.get<any[]>(url, { headers });
    }
}
