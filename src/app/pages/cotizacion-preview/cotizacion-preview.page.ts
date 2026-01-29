import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ClientesService } from '@core/services/clientes.service';
import { CotizacionStateService } from '@core/services/cotizacion-state.service';
import { CotizacionesService } from '@core/services/cotizaciones.service';
import { SectionBannerComponent } from '../../shared/components/section/section-actividades.components';
import { FooterAprobacionComponent } from '@shared/components/footer-aprobacion/footer-aprobacion.components';

import { switchMap, of } from 'rxjs';

@Component({
  selector: 'app-cotizacion-preview-page',
  standalone: true,
  imports: [CommonModule, SectionBannerComponent, FooterAprobacionComponent],
  templateUrl: './cotizacion-preview.page.html',
  styleUrls: ['./cotizacion-preview.page.css'],
})
export class CotizacionPreviewPage {

  portadaUrl = 'https://dngqawqeaifyfhbklova.supabase.co/storage/v1/object/public/Portada/Portada%20Cotizador.png';

  asesorNombre = '';
  asesorImg = '';
  asesorTelefono = '';
  asesorEmail = '';

  show360 = false;
  recorridoImg = '';

  torreNombre = '';
  aptoLabel = '';

  showConceptoCiudadViva = false;
  ubicacionImg = '';
  ciudadVivaImg = '';
  showActividades = false;

  apartamentoImg = '';
  planoImg = '';
  areaTotal: number | null = null;
  showCotizacionDolares = false;

  data: any = {};
  currDate = new Date();

  private clientesService = inject(ClientesService);
  private cotizacionesService = inject(CotizacionesService);
  private state = inject(CotizacionStateService);

  constructor(private router: Router) { }

  ngOnInit() {
    const data = this.state.load<any>();
    this.data = data || {};

    // Extraer valor cuota mensual del plan
    if (this.data.plan && Array.isArray(this.data.plan) && this.data.plan.length > 0) {
      // Tomamos el primer valor de cuota de apartamento que encuentre
      const firstRow = this.data.plan[0];
      this.data.valorCuotaMensualReal = firstRow.valorApto || 0;
    }


    this.asesorNombre = localStorage.getItem('asesor_nombre') ?? '';
    this.asesorImg = localStorage.getItem('asesor_img') ?? '';


    this.torreNombre = localStorage.getItem('torre_nombre') ?? '';
    this.aptoLabel = localStorage.getItem('apto_label') ?? '';
    this.apartamentoImg = localStorage.getItem('apto_img') ?? '';
    this.planoImg = localStorage.getItem('apto_plano_img') ?? '';

    const a = localStorage.getItem('apto_area_total');
    this.areaTotal = a ? Number(a) : null;
    if (data) {
      this.asesorTelefono = data.telefonoEjecutivo ?? '';
      this.asesorEmail = data.correoEjecutivo ?? '';
      this.showActividades = !!data.actividadesProyecto;
      this.showCotizacionDolares = !!data.cotizacionDolares;


      if (!this.torreNombre && data.torre) {
        this.torreNombre = data.torre;
        localStorage.setItem('torre_nombre', data.torre);
      }


      if (!this.aptoLabel) {
        this.aptoLabel = localStorage.getItem('apto_label') ?? '';
      }

      this.showConceptoCiudadViva = !!data?.conceptoCiudadViva;
      if (this.showConceptoCiudadViva) {
        this.ubicacionImg = localStorage.getItem('proyecto_ubicacion_img') ?? '';
        this.ciudadVivaImg = localStorage.getItem('proyecto_ciudadviva_img') ?? '';
      }


    }


    const form = this.state.load<any>();

    if (form) {
      this.show360 = !!form.link360;
      this.recorridoImg = localStorage.getItem('proyecto_recorrido') ?? '';
    }

    console.log('Preview loaded:', {
      torreNombre: this.torreNombre,
      aptoLabel: this.aptoLabel,
      asesorNombre: this.asesorNombre,
      data: data
    });
  }


  volver() {
    this.router.navigate(['/cotizacion-form']);
  }

  async generarPDF() {
    const data = this.state.load<any>();
    if (!data) {
      console.error('No hay datos para generar cotización');
      this._generatePDF(); // Fallback
      return;
    }

    const clientePayload = {
      tipo_documento: data.tipoDocumento,
      numero_documento: data.noDocumento,
      nombres: data.nombres,
      apellidos: data.apellidos,
      direccion: data.direccion,
      telefono: data.telefono,
      email: data.correo
    };

    this.clientesService.getClienteByDocumento(data.noDocumento).pipe(
      switchMap((clientes: any[]) => {
        if (clientes && clientes.length > 0) {
          return of(clientes);
        } else {
          return this.clientesService.createCliente(clientePayload);
        }
      }),
      switchMap((clientes: any) => {
        const clienteId = clientes?.[0]?.id;
        if (!clienteId) {
          console.error('No se pudo obtener el ID del cliente');
          alert('Error: No se pudo registrar el cliente. Verifique la consola.');
          return of(null);
        }

        const cotizacionPayload = {
          cliente_id: clienteId,
          asesor_id: data.nombreEjecutivo,
          apartamento_id: null,
          snapshot_datos: {
            informacion_usuario: {
              tipo_documento: data.tipoDocumento,
              numero_documento: data.noDocumento,
              nombres: data.nombres,
              apellidos: data.apellidos,
              correo: data.correo,
              telefono: data.telefono,
              canal: data.canal,
              direccion: data.direccion
            },
            informacion_apartamento: {
              proyecto: data.proyecto,
              torre: data.torre,
              apartamento: data.apartamento,
              valor_total: data.valorTotal,
              beneficio_valorizacion: data.beneficioValorizacion,
              concepto_beneficio_valorizacion: data.conceptoBeneficioValorizacion,
              beneficio_pronta_separacion: data.beneficioProntaSeparacion,
              concepto_beneficio_pronta_separacion: data.conceptoBeneficioProntaSeparacion,
              valor_especial_hoy: data.valorEspecialHoy,
              porcentaje_cuota_inicial: data.porcentajeCuotaInicial,
              cantidad_cuotas: data.cantidadCuotas,
              fecha_ultima_cuota: data.fechaUltimaCuota
            },
            informacion_adicionales: {
              items_seleccionados: [
                data.parqueadero ? 'Parqueadero' : null,
                data.kitAcabados ? 'Kit de Acabados' : null,
                data.kitDomotica ? 'Kit de domótica' : null
              ].filter(Boolean),
              cantidad_parqueaderos: data.cantidadParqueaderos,
              cuotas_financiacion: data.cuotasFinanciacion,
              valor_total_adicionales: data.valorTotalAdicionales,
              fecha_ultima_cuota_adic: data.fechaUltimaCuotaAdic
            },
            informacion_cotizacion: {
              asesor_id: data.nombreEjecutivo,
              nombre_ejecutivo: this.asesorNombre,
              telefono_ejecutivo: this.asesorTelefono,
              correo_ejecutivo: this.asesorEmail,
              cotizacion_valida_hasta: data.cotizacionValidaHasta,
              link_360: data.link360,
              concepto_ciudad_viva: data.conceptoCiudadViva,
              actividades_proyecto: data.actividadesProyecto
            }
          }
        };

        return this.cotizacionesService.crearCotizacion(cotizacionPayload);
      })
    ).subscribe({
      next: (res) => {
        if (res) {
          console.log('Cotización guardada exitosamente', res);
          this._generatePDF();
        }
      },
      error: (err) => {
        console.error('Error en el proceso de guardado', err);
        alert('Ocurrió un error al guardar la cotización. Revise la consola para más detalles.');
        this._generatePDF();
      }
    });
  }

  private async _generatePDF() {
    const el = document.getElementById('pdf-content');
    if (!el) return;

    const scale = 2;

    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      backgroundColor: null,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/jpeg', 1.0);

    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      let y = 0;
      let heightLeft = imgHeight;

      while (heightLeft > 0) {
        pdf.addImage(imgData, 'JPEG', 0, y, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        y -= pageHeight;

        if (heightLeft > 0) pdf.addPage();
      }
    }
    pdf.save('cotizacion.pdf');

    localStorage.clear();
    sessionStorage.clear();
    this.router.navigate(['/cotizacion-form']);
  }
}