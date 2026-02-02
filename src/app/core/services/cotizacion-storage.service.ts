import { Injectable } from '@angular/core';
import { Proyectos } from '@core/models/proyecto.model';
import { Apartamentos } from '@core/models/apartamento.model';
import { Asesor } from '@core/models/asesor.model';

@Injectable({
    providedIn: 'root'
})
export class CotizacionStorageService {

    constructor() { }

    saveProyecto(proyecto: Proyectos) {
        localStorage.setItem('proyecto_nombre', proyecto.nombre ?? '');
        localStorage.setItem('proyecto_logo', proyecto.logo_url ?? '');
        localStorage.setItem('proyecto_recorrido', proyecto.link_recorrido_360 ?? '');
        localStorage.setItem('proyecto_ubicacion_img', proyecto.ubicacion_img ?? '');
        localStorage.setItem('proyecto_ciudadviva_img', proyecto.ciudadviva_img ?? '');
    }

    saveTorre(torre: string) {
        localStorage.setItem('torre_nombre', torre ?? '');
    }

    saveApartamento(apto: Apartamentos) {
        localStorage.setItem('apto_label', String(apto.numero_apto ?? ''));
        localStorage.setItem('apto_img', apto.apartamento_img ?? '');
        localStorage.setItem('apto_plano_img', apto.plano_img ?? '');
        localStorage.setItem('apto_area_total', String(apto.area_total ?? ''));
    }

    saveAsesor(asesor: Asesor) {
        localStorage.setItem('asesor_nombre', asesor.nombre_completo ?? '');
        localStorage.setItem('asesor_img', asesor.link_img ?? '');
        localStorage.setItem('asesor_telefono', asesor.telefono ?? '');
        localStorage.setItem('asesor_email', asesor.email ?? '');
    }

    clear() {
        localStorage.clear();
        sessionStorage.clear();
    }
}
