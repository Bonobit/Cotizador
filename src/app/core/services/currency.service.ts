import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, shareReplay } from 'rxjs';

@Injectable({
    providedIn: 'root'
})
export class CurrencyService {
    private http = inject(HttpClient);

    // API de DolarApi.com para Colombia (Alta precisión y actualización frecuente)
    private readonly TRM_API_URL = 'https://co.dolarapi.com/v1/trm';

    private trmCache$?: Observable<number>;

    /**
     * Obtiene la TRM vigente (la más reciente reportada)
     * Se actualiza frecuentemente para reflejar los cambios oficiales.
     */
    getLatestTRM(): Observable<number> {
        if (this.trmCache$) return this.trmCache$;

        this.trmCache$ = this.http.get<any>(this.TRM_API_URL).pipe(
            map(data => {
                const valor = data && data.valor ? parseFloat(data.valor) : 0;
                if (!valor || isNaN(valor)) {
                    throw new Error('Invalid TRM value from primary API');
                }
                return valor;
            }),
            catchError(err => {
                console.warn('Error fetching TRM from DolarApi, trying fallback...', err);
                // Fallback a ExchangeRate-API (Market Rate)
                return this.http.get<any>('https://open.er-api.com/v6/latest/USD').pipe(
                    map(data => {
                        const valor = data?.rates?.COP;
                        return valor || 3950;
                    }),
                    catchError(() => {
                        // Último recurso: Datos Abiertos
                        return this.http.get<any[]>('https://datos.gov.co/resource/m97f-n6kh.json?$limit=1&$order=vigenciadesde DESC').pipe(
                            map(data => (data && data.length > 0) ? parseFloat(data[0].valor) : 4000),
                            catchError(() => of(4000))
                        );
                    })
                );
            }),
            shareReplay(1)
        );

        return this.trmCache$;
    }

    /**
     * Convierte un valor en COP a USD basado en la TRM actual
     */
    convertToUSD(valueCop: number, trm: number): number {
        if (!valueCop || !trm) return 0;
        return Math.round(valueCop / trm);
    }
}
