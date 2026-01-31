import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import {
    FormArray,
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CotizacionStateService } from '@core/services/cotizacion-state.service';
import { AsesoresService } from '@core/services/asesores.service';
import { Asesor } from '@core/models/asesor.model';
import { ProyectosService } from '@core/services/proyectos.service';
import { Proyectos } from '@core/models/proyecto.model';
import { ApartamentosService } from '@core/services/apartamentos.service';
import { Apartamentos } from '@core/models/apartamento.model';
import { CotizacionesService } from '@core/services/cotizaciones.service';
import { CopCurrencyDirective } from '@shared/directives/cop-currency.directive';
import { AdicionalesManagerService, ADICIONALES_CONFIG } from '@core/services/adicionales-manager.service';
import { AdicionalConfig } from '@core/models/adicional-config.model';
import { PlanPagosService, PlanPagosItem } from '@core/services/plan-pagos.service';

@Component({
    selector: 'app-cotizacion-form-page',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, CopCurrencyDirective],
    templateUrl: './cotizacion-form.page.html',
    styleUrls: ['./cotizacion-form.page.css'],
})

export class CotizacionFormPage implements OnInit {
    cotizacionNoLabel$!: Observable<string>;
    showPlan = false;

    // Fecha mínima para inputs de tipo date (hoy)
    fechaMinima: string = new Date().toISOString().split('T')[0];

    form!: FormGroup;
    asesores: Asesor[] = [];
    cargandoAsesores = false;
    proyectos: Proyectos[] = [];
    cargandoProyectos = false;
    errorAsesores = '';
    errorProyectos = '';

    // Apartamentos logic
    allApartamentos: Apartamentos[] = []; // Todos los del proyecto
    apartamentosFiltrados: Apartamentos[] = []; // Los de la torre seleccionada
    torres: string[] = []; // Lista de torres únicas
    cargandoApartamentos = false;

    // Adicionales config
    adicionalesConfig: AdicionalConfig[] = ADICIONALES_CONFIG;

    // Sistema de tabs para adicionales
    tabActivoAdicional: string | null = null;
    planesAdicionales: Map<string, FormArray> = new Map();

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private asesoresService: AsesoresService,
        private proyectosService: ProyectosService,
        private state: CotizacionStateService,
        private cdr: ChangeDetectorRef,
        private cotizacionesService: CotizacionesService,
        private apartamentosService: ApartamentosService,
        private adicionalesManager: AdicionalesManagerService,
        private planPagosService: PlanPagosService
    ) {
        this.form = this.fb.group({
            tipoDocumento: ['', Validators.required],
            noDocumento: ['', [
                Validators.maxLength(10),
                Validators.pattern(/^[0-9]+$/),
                Validators.required,
                Validators.min(0)
            ]],

            nombres: ['', [Validators.required, Validators.maxLength(60)]],
            apellidos: ['', [Validators.required, Validators.maxLength(60)]],
            direccion: ['', [Validators.required, Validators.maxLength(120)]],
            telefono: ['', [
                Validators.required,
                Validators.maxLength(10),
                Validators.pattern(/^[0-9]+$/),
            ]],
            correo: ['', [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)]],
            canal: ['', Validators.required],

            // Apartamento
            proyecto: [null, Validators.required],
            torre: ['', Validators.required],
            apartamento_id: [null],
            apartamento: ['', Validators.required],

            valorTotal: [{ value: null, disabled: true }, Validators.required],
            beneficioValorizacion: [0, Validators.required],

            conceptoBeneficioValorizacion: [''],

            beneficioProntaSeparacion: [0, Validators.required],

            conceptoBeneficioProntaSeparacion: [''],

            valorEspecialHoy: [{ value: null, disabled: true }],

            porcentajeCuotaInicial: [20, Validators.required],
            valorCuotaInicial: [{ value: null, disabled: true }],

            fechaUltimaCuota: ['', Validators.required],
            cantidadCuotas: [{ value: 0, disabled: true }],


            // Adicionales - se generan dinámicamente desde el servicio
            ...this.generateAdicionalesControls(),

            aprobador: [{ value: '0', disabled: true }],

            nombreEjecutivo: [null, [Validators.required]],
            telefonoEjecutivo: [{ value: '', disabled: true }, [
                Validators.required,
                Validators.maxLength(10),
                Validators.pattern(/^[0-9]{1,10}$/)
            ]],

            correoEjecutivo: [{ value: '', disabled: true }, [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)]],

            conceptoCiudadViva: [false],
            actividadesProyecto: [false],
            link360: [{ value: false, disabled: true }],
            cotizacionDolares: [false],
            cotizacionValidaHasta: ['', Validators.required],

            plan: this.fb.array([]),
        });

        this.setupAdicionalesRule();
        this.setupCalculos();
    }

    ngOnInit() {
        this.cotizacionNoLabel$ = this.cotizacionesService.getUltimaCotizacion().pipe(
            map(data => {
                const nextId = (data?.[0]?.serial_id || 0) + 1;
                return String(nextId).padStart(4, '0');
            }),
            shareReplay(1)
        );

        this.cargarAsesores();
        this.listenEjecutivoChanges();

        this.cargarProyectos();
        this.listenProyectosChanges();
        this.listenTorreChanges();
        this.listenApartamentoChanges();
        this.setupDocTypeRule();

        // Restaurar estado si venimos del preview
        const savedForm = this.state.load();
        if (savedForm) {
            // 1. Aplicar valores iniciales (esto restaurará los checkboxes y campos habilitados)
            this.form.patchValue(savedForm, { emitEvent: false });

            // 2. Actualizar estado de adicionales (esto habilitará campos si el checkbox está marcado)
            this.adicionalesConfig.forEach(config => {
                this.adicionalesManager.updateAdicionalState(this.form, config);
            });

            // 3. Volver a aplicar valores ahora que los campos están habilitados
            // Esto es necesario porque patchValue ignora campos deshabilitados
            this.form.patchValue(savedForm, { emitEvent: false });

            this.recalculateAll();

            if (savedForm.proyecto) {
                const proyectoId = savedForm.proyecto;
                this.cargandoApartamentos = true;

                this.apartamentosService.getApartamentosByProyecto(proyectoId).subscribe({
                    next: (data) => {
                        this.allApartamentos = data ?? [];

                        const t = new Set(this.allApartamentos.map(a => a.torre).filter(Boolean));
                        this.torres = Array.from(t).sort();

                        if (savedForm.torre) {
                            localStorage.setItem('torre_nombre', savedForm.torre);

                            this.apartamentosFiltrados = this.allApartamentos.filter(
                                a => a.torre === savedForm.torre
                            );

                            // Re-aplicar valor de torre para asegurar que el dropdown lo muestre
                            this.form.patchValue({ torre: savedForm.torre }, { emitEvent: false });
                        }

                        if (savedForm.apartamento) {
                            const apto = this.allApartamentos.find(a => a.id === savedForm.apartamento);
                            if (apto) {
                                localStorage.setItem('apto_label', String(apto.numero_apto ?? ''));
                                localStorage.setItem('apto_img', apto.apartamento_img ?? '');
                                localStorage.setItem('apto_plano_img', apto.plano_img ?? '');
                                localStorage.setItem('apto_area_total', String(apto.area_total ?? ''));

                                // Re-aplicar valor de apartamento
                                this.form.patchValue({ apartamento: savedForm.apartamento }, { emitEvent: false });

                                // Forzar valor total y recalcular (porque patchValue ignora campos deshabilitados)
                                if (apto.precio_lista) {
                                    this.form.get('valorTotal')?.setValue(apto.precio_lista);
                                    this.recalculateAll();
                                }
                            }
                        }

                        this.cargandoApartamentos = false;
                        this.cdr.markForCheck();

                        // Regenerar planes de pago (esto llenará el Map de adicionales que no se guarda en el form)
                        // setTimeout para asegurar que el ciclo de detección de cambios haya terminado
                        setTimeout(() => {
                            if (this.form.valid || (this.form.get('cantidadCuotas')?.value > 0)) {
                                this.generarPlan();
                            }
                        }, 100);
                    },
                    error: (err) => {
                        console.error('Error loading apartments during restore:', err);
                        this.cargandoApartamentos = false;
                        this.cdr.markForCheck();
                    }
                });
            }

            if (Array.isArray(savedForm.plan)) {
                this.plan.clear();
                for (const row of savedForm.plan) {
                    this.plan.push(this.fb.group({
                        fechaApto: new FormControl(row.fechaApto ?? ''),
                        valorApto: new FormControl(row.valorApto ?? ''),
                        fechaAdic: new FormControl(row.fechaAdic ?? ''),
                        valorAdic: new FormControl(row.valorAdic ?? ''),
                    }));
                }
            }


        }


    }
    private cargarProyectos() {
        this.cargandoProyectos = true;
        this.errorProyectos = '';

        this.proyectosService.getProyectosActivos().subscribe({
            next: (data) => {
                this.proyectos = data ?? [];
                this.cargandoProyectos = false;

                // Preseleccionar Nogales ssi no hay un proyecto ya seleccionado (por caché)
                const currentVal = this.form.get('proyecto')?.value;
                if (!currentVal) {
                    const nogales = this.proyectos.find(p => p.nombre?.toLowerCase().includes('nogales'));
                    if (nogales) {
                        this.form.patchValue({ proyecto: nogales.id });
                    }
                }

                // Siempre bloquear el campo
                this.form.get('proyecto')?.disable();

                this.cdr.markForCheck();
            },
            error: (err) => {
                this.cargandoProyectos = false;
                this.errorProyectos = 'No fue posible cargar los proyectos.';
                console.error(err);
                this.cdr.markForCheck();
            }
        });

    }

    limpiarTodo() {
        localStorage.clear();
        sessionStorage.clear();
        this.form.reset();
        this.plan.clear();
    }

    private listenProyectosChanges() {
        this.form.get('proyecto')!.valueChanges.subscribe((id: number | null) => {
            // Limpiar dependientes
            this.form.patchValue({

                torre: '',
                apartamento: '',
                valorTotal: null,
                fechaUltimaCuota: ''
            }, { emitEvent: false });

            this.torres = [];
            this.allApartamentos = [];
            this.apartamentosFiltrados = [];

            const proyecto = this.proyectos.find(a => a.id === Number(id));
            if (!proyecto) return;

            // Guardar en local storage para preview
            localStorage.setItem('proyecto_nombre', proyecto.nombre ?? '');
            localStorage.setItem('proyecto_logo', proyecto.logo_url ?? '');
            localStorage.setItem('proyecto_recorrido', proyecto.link_recorrido_360 ?? '');

            localStorage.setItem('proyecto_ubicacion_img', proyecto.ubicacion_img ?? '');
            localStorage.setItem('proyecto_ciudadviva_img', proyecto.ciudadviva_img ?? '');


            // Cargar apartamentos del proyecto
            this.cargandoApartamentos = true;
            this.apartamentosService.getApartamentosByProyecto(proyecto.id).subscribe({
                next: (data) => {
                    this.allApartamentos = data ?? [];
                    // Extraer torres únicas
                    const t = new Set(this.allApartamentos.map(a => a.torre).filter(Boolean));
                    this.torres = Array.from(t).sort();
                    this.cargandoApartamentos = false;
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    console.error('Error cargando apartamentos', err);
                    this.cargandoApartamentos = false;
                }
            });
        });
    }

    private listenTorreChanges() {
        this.form.get('torre')!.valueChanges.subscribe((torre: string) => {
            this.form.patchValue({ apartamento: '', valorTotal: null }, { emitEvent: false });

            localStorage.setItem('torre_nombre', torre ?? '');

            if (!torre) {
                this.apartamentosFiltrados = [];
                return;
            }

            this.apartamentosFiltrados = this.allApartamentos.filter(a => a.torre === torre);
            this.cdr.markForCheck();
        });
    }

    private listenApartamentoChanges() {
        this.form.get('apartamento')!.valueChanges.subscribe((aptoId: string) => {
            const apto = this.allApartamentos.find(a => a.id === aptoId);
            if (!apto) return;

            // ✅ label
            localStorage.setItem('apto_label', String(apto.numero_apto ?? ''));

            localStorage.setItem('apto_img', apto.apartamento_img ?? '');
            localStorage.setItem('apto_plano_img', apto.plano_img ?? '');
            localStorage.setItem('apto_area_total', String(apto.area_total ?? ''));

            const values: any = {};
            if (apto.precio_lista) values.valorTotal = apto.precio_lista;
            this.form.patchValue(values);
        });
    }

    private cargarAsesores() {
        this.cargandoAsesores = true;
        this.errorAsesores = '';

        this.asesoresService.getAsesoresActivos().subscribe({
            next: (data) => {
                this.asesores = data ?? [];
                this.cargandoAsesores = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.cargandoAsesores = false;
                this.errorAsesores = 'No fue posible cargar los asesores.';
                console.error(err);
                this.cdr.markForCheck();
            }
        });
    }

    private listenEjecutivoChanges() {
        this.form.get('nombreEjecutivo')!.valueChanges.subscribe((id: number | null) => {
            const asesor = this.asesores.find(a => a.id === Number(id));
            if (!asesor) return;

            // Autollenar
            this.form.patchValue({
                telefonoEjecutivo: asesor.telefono ?? '',
                correoEjecutivo: asesor.email ?? '',
            }, { emitEvent: false });

            localStorage.setItem('asesor_nombre', asesor.nombre_completo ?? '');
            localStorage.setItem('asesor_img', asesor.link_img ?? '');
            localStorage.setItem('asesor_telefono', asesor.telefono ?? '');
            localStorage.setItem('asesor_email', asesor.email ?? '');
        });
    }

    get plan(): FormArray<FormGroup> {
        return this.form.get('plan') as FormArray<FormGroup>;
    }

    get cantidadCuotasValue(): number {
        return this.form.get('cantidadCuotas')?.value || 0;
    }

    /**
     * Obtiene los adicionales que están seleccionados (checkbox activo)
     */
    getAdicionalesSeleccionados(): AdicionalConfig[] {
        return this.adicionalesConfig.filter(config =>
            this.form.get(config.formControls.checkbox)?.value === true
        );
    }

    /**
     * Cambia el tab activo de adicionales
     */
    cambiarTabAdicional(adicionalId: string): void {
        this.tabActivoAdicional = adicionalId;
    }

    private createPlanRow() {
        return this.fb.group({
            fechaApto: new FormControl({ value: '', disabled: true }), // Siempre bloqueada (calculada)
            valorApto: new FormControl({ value: '', disabled: true }), // Disabled por defecto
            editarValorApto: new FormControl(false), // Checkbox para habilitar edición
            fechaAdic: new FormControl(''),
            valorAdic: new FormControl(''),
        });
    }

    generarPlan() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.showPlan = false;
            return;
        }

        // Limpiar datos anteriores
        this.plan.clear();
        this.planesAdicionales.clear();

        // 1. Generar plan del apartamento
        const cantidadCuotas = this.form.get('cantidadCuotas')?.value || 0;
        const fechaUltima = this.form.get('fechaUltimaCuota')?.value;
        const valorEspecial = this.form.get('valorEspecialHoy')?.value || 0;
        const inicial = this.form.get('valorCuotaInicial')?.value || 0;

        const planApto = this.planPagosService.generarPlanPagos({
            valorTotal: valorEspecial,
            valorInicial: inicial,
            cantidadCuotas: cantidadCuotas,
            fechaUltimaCuota: fechaUltima
        });

        // Construir FormArray usando createPlanRow
        planApto.forEach(item => {
            const row = this.createPlanRow();

            // Establecer valores
            row.get('fechaApto')?.setValue(item.fecha, { emitEvent: false });
            row.get('valorApto')?.setValue(item.valor.toString(), { emitEvent: false });

            // Listener para el checkbox editarValorApto
            row.get('editarValorApto')?.valueChanges.subscribe(editar => {
                const valorAptoControl = row.get('valorApto');
                if (editar) {
                    valorAptoControl?.enable({ emitEvent: false });
                } else {
                    valorAptoControl?.disable({ emitEvent: false });
                }
            });

            this.plan.push(row);
        });

        // 2. Generar planes individuales por cada adicional seleccionado
        const adicionalesSeleccionados = this.getAdicionalesSeleccionados();

        // Helper para limpiar valores numéricos (quitando $, puntos, espacios)
        const toNum = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(String(v).replace(/[^0-9]/g, "")) || 0);

        adicionalesSeleccionados.forEach(config => {
            const cuotas = toNum(this.form.get(config.formControls.cuotasFinanciacion)?.value);
            const fechaUltimaCuota = this.form.get(config.formControls.fechaUltimaCuota)?.value;
            const beneficio = toNum(this.form.get(config.formControls.beneficio)?.value);
            const valorTotal = toNum(this.form.get(config.formControls.valorTotal)?.value);

            // Calcular el valor después del beneficio
            const valorDespuesBeneficio = Math.max(valorTotal - beneficio, 0);

            // Calcular valor cuota explícitamente para garantizar precisión y tipo numérico
            let valorCuotaCalculada = 0;
            if (cuotas > 0) {
                valorCuotaCalculada = Math.round(valorDespuesBeneficio / cuotas);
            }

            const plan = this.planPagosService.generarPlanPagos({
                valorTotal: valorDespuesBeneficio,
                valorInicial: 0,
                cantidadCuotas: cuotas,
                fechaUltimaCuota: fechaUltimaCuota,
                valorCuotaManual: valorCuotaCalculada
            });

            // Crear FormArray para este adicional (igual que el apartamento)
            const formArrayAdicional = this.fb.array<FormGroup>([]);

            plan.forEach(item => {
                const row = this.createPlanRow();

                // Establecer valores
                row.get('fechaApto')?.setValue(item.fecha, { emitEvent: false });
                row.get('valorApto')?.setValue(item.valor.toString(), { emitEvent: false });

                // Listener para el checkbox editarValorApto
                row.get('editarValorApto')?.valueChanges.subscribe(editar => {
                    const valorAptoControl = row.get('valorApto');
                    if (editar) {
                        valorAptoControl?.enable({ emitEvent: false });
                    } else {
                        valorAptoControl?.disable({ emitEvent: false });
                    }
                });

                formArrayAdicional.push(row);
            });

            // Almacenar en el Map
            this.planesAdicionales.set(config.id, formArrayAdicional);
        });

        // 3. Establecer el primer adicional como tab activo
        if (adicionalesSeleccionados.length > 0) {
            this.tabActivoAdicional = adicionalesSeleccionados[0].id;
        }

        this.showPlan = true;
    }



    generarCotizacion() {
        this.state.save(this.form.getRawValue());
        this.router.navigate(['/preview']);
    }

    isInvalid(name: string): boolean {
        const c = this.form.get(name);
        return !!c && !c.disabled && c.invalid && (c.touched || c.dirty);
    }

    private setupDocTypeRule() {
        const tipo = this.form.get('tipoDocumento')!;
        const doc = this.form.get('noDocumento')!;

        const apply = () => {
            const hasDoc = String(doc.value ?? '').trim().length > 0;
            if (hasDoc) tipo.setValidators([Validators.required]);


            tipo.updateValueAndValidity({ emitEvent: false });
        };

        doc.valueChanges.subscribe(apply);
        apply();
    }

    /**
     * Genera los controles de formulario para todos los adicionales
     */
    private generateAdicionalesControls(): { [key: string]: any } {
        let controls: { [key: string]: any } = {};

        this.adicionalesConfig.forEach(config => {
            const adicControls = this.adicionalesManager.createFormControls(config);
            controls = { ...controls, ...adicControls };
        });

        return controls;
    }

    /**
     * Configura las reglas y suscripciones para todos los adicionales
     */
    private setupAdicionalesRule() {
        // Suscribirse a cambios de cada checkbox de adicional
        this.adicionalesConfig.forEach(config => {
            const checkboxControl = this.form.get(config.formControls.checkbox);
            if (checkboxControl) {
                checkboxControl.valueChanges.subscribe(() => {
                    this.adicionalesManager.updateAdicionalState(this.form, config);
                });
            }

            // Suscribirse a cambios de fecha para calcular cuotas
            const fechaControl = this.form.get(config.formControls.fechaUltimaCuota);
            if (fechaControl) {
                fechaControl.valueChanges.subscribe(() => {
                    this.adicionalesManager.calculateCuotasFinanciacion(this.form, config);
                });
            }

            // Suscribirse a cambios de valorTotal y beneficio para calcular valorCuota
            const valorTotalControl = this.form.get(config.formControls.valorTotal);
            if (valorTotalControl) {
                valorTotalControl.valueChanges.subscribe(() => {
                    this.adicionalesManager.calculateValorCuota(this.form, config);
                });
            }

            const beneficioControl = this.form.get(config.formControls.beneficio);
            if (beneficioControl) {
                beneficioControl.valueChanges.subscribe(() => {
                    this.adicionalesManager.calculateValorCuota(this.form, config);
                });
            }
        });

        // Aplicar estado inicial
        this.adicionalesConfig.forEach(config => {
            this.adicionalesManager.updateAdicionalState(this.form, config);
        });
    }

    private setupCalculos() {
        const valorTotal = this.form.get('valorTotal')!;
        const benefVal = this.form.get('beneficioValorizacion')!;
        const benefPronta = this.form.get('beneficioProntaSeparacion')!;
        const porcentaje = this.form.get('porcentajeCuotaInicial')!;
        const fechaUlt = this.form.get('fechaUltimaCuota')!;

        // recalcular cuando cambien inputs clave
        valorTotal.valueChanges.subscribe(() => this.recalculateAll());
        benefVal.valueChanges.subscribe(() => this.recalculateAll());
        benefPronta.valueChanges.subscribe(() => this.recalculateAll());
        porcentaje.valueChanges.subscribe(() => this.recalculateAll());
        fechaUlt.valueChanges.subscribe(() => this.recalculateAll());

        this.recalculateAll();
    }

    private recalculateAll() {
        const valorTotal = this.form.get('valorTotal')!;
        const benefVal = this.form.get('beneficioValorizacion')!;
        const benefPronta = this.form.get('beneficioProntaSeparacion')!;
        const valorEspecial = this.form.get('valorEspecialHoy')!;
        const porcentaje = this.form.get('porcentajeCuotaInicial')!;
        const valorCuotaInicial = this.form.get('valorCuotaInicial')!;
        const fechaUlt = this.form.get('fechaUltimaCuota')!;
        const cantCuotas = this.form.get('cantidadCuotas')!;
        const aprobador = this.form.get('aprobador')!;

        const toNum = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);

        const vt = toNum(valorTotal.value);
        const bv = toNum(benefVal.value);
        const bp = toNum(benefPronta.value);
        const porcentajeBeneficio = 0.15;
        const maxBeneficio = vt * porcentajeBeneficio;
        const totalBeneficios = bv + bp;

        if (totalBeneficios > maxBeneficio) {
            aprobador.enable({ emitEvent: false });
        }
        else {
            aprobador.setValue(false, { emitEvent: false });
            aprobador.disable({ emitEvent: false });
        }
        const especial = Math.max(vt - bv - bp, 0);
        valorEspecial.setValue(especial, { emitEvent: false });
        const p = toNum(porcentaje.value);
        const cuotaIni = Math.round(especial * (p / 100));
        valorCuotaInicial.setValue(cuotaIni, { emitEvent: false });

        // Helper para calcular meses
        const calcMonths = (dateStr: string) => {
            const f = dateStr ? new Date(dateStr) : null;
            if (!f || isNaN(f.getTime())) return null;

            const start = new Date();
            start.setMonth(start.getMonth() + 1);
            start.setDate(1);

            const months = (f.getFullYear() - start.getFullYear()) * 12 +
                (f.getMonth() - start.getMonth()) + 1;

            return Math.max(months, 0);
        };

        // Cantidad de cuotas para el apartamento
        const m = calcMonths(fechaUlt.value);
        cantCuotas.setValue(m, { emitEvent: false });

        // Las cuotas de adicionales ahora se calculan individualmente en el servicio
    }

    fieldLabels: Record<string, string> = {
        tipoDocumento: 'Tipo documento',
        noDocumento: 'Número de documento',
        nombres: 'Nombres',
        apellidos: 'Apellidos',
        direccion: 'Dirección',
        telefono: 'Teléfono',
        correo: 'Correo',
        canal: 'Canal',
        proyecto: 'Proyecto',
        torre: 'Torre',
        apartamento: 'Apartamento',
        valorTotal: 'Valor total',
        fechaUltimaCuota: 'Fecha última cuota',
        cotizacionValidaHasta: 'Cotización válida hasta',
        nombreEjecutivo: 'Nombre del ejecutivo',
        telefonoEjecutivo: 'Teléfono del ejecutivo',
        correoEjecutivo: 'Correo del ejecutivo',
    };

    get porcentajesCuotaInicial() {
        return Array.from({ length: 17 }, (_, i) => 20 + i * 5);
    }

    getErrorMessage(controlName: string): string {
        const c = this.form.get(controlName);
        if (!c) return '';

        const label = (this.fieldLabels[controlName] ?? controlName).toLowerCase();

        if (c.hasError('required')) {
            return `El campo "${label}" es requerido.`;
        }

        if (c.hasError('email')) {
            return `El campo "${label}" debe ser un correo válido.`;
        }
        if (c.hasError('maxlength')) {
            const req = c.getError('maxlength')?.requiredLength;
            return `El campo "${label}" debe tener máximo ${req} caracteres.`;
        }

        if (c.hasError('minlength')) {
            const req = c.getError('minlength')?.requiredLength;
            return `El campo "${label}" debe tener mínimo ${req} caracteres.`;
        }
        if (c.hasError('pattern')) {
            return `El campo "${label}" tiene un formato inválido.`;
        }

        if (c.hasError('min')) {
            const min = c.getError('min')?.min;
            return `El campo "${label}" debe ser mayor o igual a ${min}.`;
        }

        if (c.hasError('max')) {
            const max = c.getError('max')?.max;
            return `El campo "${label}" debe ser menor o igual a ${max}.`;
        }

        if (c.hasError('benefitsExceeded')) {
            return `La suma de beneficios excede el 50% del valor total.`;
        }

        return `El campo "${label}" es inválido.`;
    }
}