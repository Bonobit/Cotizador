import { Component, inject, DestroyRef, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { ClientesService } from '@core/services/clientes.service';
import { CotizacionStateService } from '@core/services/cotizacion-state.service';
import { CotizacionesService } from '@core/services/cotizaciones.service';
import { LoggerService } from '@core/services/logger.service';
import { SectionBannerComponent } from '../../shared/components/section/section-actividades.components';
import { FooterAprobacionComponent } from '@shared/components/footer-aprobacion/footer-aprobacion.components';
import { CotizacionFormState } from '@core/models/form-state.model';

import { switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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

  // Partial permite que data tenga solo algunos campos de CotizacionFormState
  // Esto evita errores de "possibly null" en el template
  data: Partial<CotizacionFormState> = {};
  currDate = new Date();
  isLoading = true;
  private imagesToLoad = 0;
  private imagesLoaded = 0;

  private cdr = inject(ChangeDetectorRef);
  private clientesService = inject(ClientesService);
  private cotizacionesService = inject(CotizacionesService);
  private state = inject(CotizacionStateService);
  private logger = inject(LoggerService);
  private destroyRef = inject(DestroyRef);

  constructor(private router: Router) { }

  ngOnInit() {
    const data = this.state.load();
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


    const form = this.state.load();

    if (form) {
      this.show360 = !!form.link360;
      this.recorridoImg = localStorage.getItem('proyecto_recorrido') ?? '';
    }

    this.logger.log('Preview loaded:', {
      torreNombre: this.torreNombre,
      aptoLabel: this.aptoLabel,
      asesorNombre: this.asesorNombre,
      data: data
    });

    // 1. Calcular inmediatamente cuántas imágenes esperamos
    this.countImagesToLoad();

    // 2. Timeout de seguridad: si después de 3 segundos no ha cargado, forzar mostrar contenido
    setTimeout(() => {
      if (this.isLoading) {
        console.warn('Timeout alcanzado - forzando fin de carga');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 3000);
  }

  private countImagesToLoad() {
    this.imagesLoaded = 0; // Reset por seguridad
    // Contamos las imágenes que existen en el DOM/Template
    let count = 0;
    if (this.portadaUrl) count++;
    if (this.asesorImg) count++;
    if (this.ubicacionImg) count++;
    if (this.ciudadVivaImg) count++;
    if (this.apartamentoImg) count++;
    if (this.planoImg) count++;

    // El footer siempre tiene una imagen de fondo
    count++;

    this.imagesToLoad = count;
    console.log(`Total de imágenes a cargar: ${this.imagesToLoad}`);

    // Si no hay imágenes, quitar loading inmediatamente
    if (this.imagesToLoad === 0) {
      this.isLoading = false;
      this.cdr.detectChanges();
    }
  }

  onFooterLoad() {
    this.onImageLoad();
  }

  onImageLoad() {
    this.imagesLoaded++;
    console.log(`✓ Imagen cargada: ${this.imagesLoaded}/${this.imagesToLoad}`);

    if (this.imagesLoaded >= this.imagesToLoad) {
      this.finishLoading();
    }
  }

  onImageError(imageName: string = 'desconocida') {
    this.imagesLoaded++;
    console.warn(`✗ Error cargando imagen ${imageName}: ${this.imagesLoaded}/${this.imagesToLoad}`);

    if (this.imagesLoaded >= this.imagesToLoad) {
      this.finishLoading();
    }
  }

  private finishLoading() {
    // Pequeño delay para suavizar la transición, pero forzando detección
    setTimeout(() => {
      console.log('Ocultando skeleton y refrescando vista');
      this.isLoading = false;
      this.cdr.detectChanges();
    }, 100);
  }


  volver() {
    this.router.navigate(['/cotizacion-form']);
  }

  async generarPDF() {
    const data = this.state.load();
    if (!data) {
      this.logger.error('No hay datos para generar cotización');
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
          this.logger.error('No se pudo obtener el ID del cliente');
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
      }),
      // takeUntilDestroyed automáticamente cancela la suscripción cuando el componente se destruye
      // Esto previene memory leaks
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        if (res) {
          this.logger.log('Cotización guardada exitosamente', res);
          // Pequeño delay de seguridad para asegurar que cualquier cambio de estado se refleje en el DOM
          setTimeout(() => {
            this._generatePDF();
          }, 200);
        }
      },
      error: (err) => {
        this.logger.error('Error en el proceso de guardado', err);
        alert('Ocurrió un error al guardar la cotización. Revise la consola para más detalles.');
        this._generatePDF();
      }
    });
  }

  private async _generatePDF() {
    const el = document.getElementById('pdf-content');
    if (!el) return;

    // --- ESTRATEGIA ROBUSTA: CLONAR NODO PARA EVITAR CORTES ---
    // 1. Clonar el elemento
    const clone = el.cloneNode(true) as HTMLElement;

    // 2. Estilos para garantizar renderizado completo (fuera del viewport visible)
    // Usamos una posición fija pero fuera de pantalla, con ancho fijo y alto automático
    Object.assign(clone.style, {
      position: 'absolute',
      top: '-9999px',
      left: '0',
      width: '100%', // O un ancho fijo en px si prefieres (ej: 800px)
      height: 'auto',
      overflow: 'visible',
      zIndex: '-1',
    });

    // 3. Insertar al body
    document.body.appendChild(clone);

    // 4. Esperar un tick para que se rendericen imágenes (si ya estaban cacheadas) o estilos
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const scale = 2;
      const canvas = await html2canvas(clone, {
        scale,
        useCORS: true,
        backgroundColor: '#ffffff', // Forzar fondo blanco
        scrollY: 0,
        windowHeight: clone.scrollHeight + 100, // Altura total + margen
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

    } catch (error) {
      console.error("Error generando PDF:", error);
    } finally {
      // 5. LIMPIEZA: Remover el clon
      document.body.removeChild(clone);
      this.router.navigate(['/cotizacion-form']);
    }
  }
}