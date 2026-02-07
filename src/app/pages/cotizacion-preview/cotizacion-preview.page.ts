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

    if (this.data.plan && Array.isArray(this.data.plan) && this.data.plan.length > 0) {
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

    this.countImagesToLoad();

    setTimeout(() => {
      if (this.isLoading) {
        console.warn('Timeout alcanzado - forzando fin de carga');
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    }, 3000);
  }

  private countImagesToLoad() {
    this.imagesLoaded = 0;
    let count = 0;

    if (this.portadaUrl) count++;
    if (this.asesorImg) count++;
    if (this.ubicacionImg) count++;
    if (this.ciudadVivaImg) count++;
    if (this.apartamentoImg) count++;
    if (this.planoImg) count++;
    count++; // Footer background

    this.imagesToLoad = count;
    console.log(`Total de imágenes a cargar: ${this.imagesToLoad}`);

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
      this._generatePDF();
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
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res) => {
        if (res) {
          this.logger.log('Cotización guardada exitosamente', res);
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

  /**
   * NUEVA ESTRATEGIA DE GENERACIÓN DE PDF OPTIMIZADA
   * - Divide el contenido en secciones lógicas
   * - Captura cada sección por separado
   * - Ensambla todo en un PDF multipágina sin cortes
   */
  private async _generatePDF() {
    console.log('🚀 Iniciando generación de PDF optimizada...');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    // Configuración para html2canvas
    const canvasOptions = {
      scale: 2, // Alta calidad
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
      removeContainer: true,
    };

    let isFirstPage = true;

    try {
      // ===============================================
      // SECCIÓN 1: PORTADA
      // ===============================================
      const portadaSection = document.querySelector('.portada-section');
      if (portadaSection) {
        console.log('📄 Capturando portada...');
        await this.addSectionToPDF(pdf, portadaSection as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
        isFirstPage = false;
      }

      // ===============================================
      // SECCIÓN: ASESOR
      // ===============================================
      const asesorSection = document.querySelector('.asesor-section');
      if (asesorSection) {
        console.log('👤 Capturando asesor...');
        await this.addSectionToPDF(pdf, asesorSection as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
        isFirstPage = false;
      }

      // ===============================================
      // SECCIÓN 2: CIUDAD VIVA
      // ===============================================
      if (this.showConceptoCiudadViva) {
        const ciudadVivaSection = document.querySelector('.ciudad-viva-section');
        if (ciudadVivaSection) {
          console.log('🏙️ Capturando Ciudad Viva...');
          await this.addSectionToPDF(pdf, ciudadVivaSection as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
          isFirstPage = false;
        }
      }

      // ===============================================
      // SECCIÓN 3: ACTIVIDADES (si está habilitado)
      // ===============================================
      if (this.showActividades) {
        const actividadesSection = document.querySelector('.section-block');
        if (actividadesSection) {
          console.log('🎯 Capturando Actividades...');
          await this.addSectionToPDF(pdf, actividadesSection as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
          isFirstPage = false;
        }
      }

      // ===============================================
      // SECCIÓN 4: APARTAMENTO
      // ===============================================
      const aptoSections = document.querySelectorAll('.apto-section');
      for (let i = 0; i < aptoSections.length; i++) {
        console.log(`🏢 Capturando Apartamento ${i + 1}...`);
        await this.addSectionToPDF(pdf, aptoSections[i] as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
        isFirstPage = false;
      }

      // ===============================================
      // SECCIÓN 5: COSTOS Y FINANCIACIÓN
      // ===============================================
      const costosSection = document.querySelector('.costos-section-capture');
      if (costosSection) {
        console.log('💰 Capturando Costos...');
        await this.addSectionToPDF(pdf, costosSection as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
        isFirstPage = false;
      }

      // ===============================================
      // SECCIÓN 6: FOOTER
      // ===============================================
      const footerSection = document.querySelector('#cotizacion-footer');
      if (footerSection) {
        console.log('📝 Capturando Footer...');
        await this.addSectionToPDF(pdf, footerSection as HTMLElement, canvasOptions, pageWidth, pageHeight, isFirstPage);
      }

      // ===============================================
      // GUARDAR PDF
      // ===============================================
      const fileName = `Cotizacion_${this.aptoLabel || 'Apto'}_${this.torreNombre || 'Torre'}.pdf`;
      pdf.save(fileName);
      console.log('✅ PDF generado exitosamente:', fileName);

    } catch (error) {
      console.error('❌ Error generando PDF:', error);
      alert('Ocurrió un error al generar el PDF. Por favor, intente nuevamente.');
    } finally {
      // Redirigir al formulario después de la generación
      setTimeout(() => {
        this.router.navigate(['/cotizacion-form']);
      }, 500);
    }
  }

  /**
   * Función auxiliar para agregar una sección al PDF
   */
  private async addSectionToPDF(
    pdf: jsPDF,
    element: HTMLElement,
    canvasOptions: any,
    pageWidth: number,
    pageHeight: number,
    isFirstPage: boolean
  ): Promise<void> {
    const canvas = await html2canvas(element, canvasOptions);
    const imgData = canvas.toDataURL('image/jpeg', 0.95);

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (!isFirstPage) {
      pdf.addPage();
    }

    // Si la sección cabe en una página
    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Si es más grande, la dividimos en múltiples páginas
      let position = 0;
      let remainingHeight = imgHeight;
      let currentPage = 0;

      while (remainingHeight > 0) {
        if (currentPage > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        position -= pageHeight;
        remainingHeight -= pageHeight;
        currentPage++;
      }
    }
  }
}