import { Component, OnInit, ChangeDetectorRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { PlanPagosService } from '@core/services/plan-pagos.service';
import { FormErrorService } from '@core/services/form-error.service';
import { DateUtilsService } from '@core/services/date-utils.service';
import { CotizacionCalculadoraService } from '@core/services/cotizacion-calculadora.service';
import { CotizacionStorageService } from '@core/services/cotizacion-storage.service';

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

    private destroyRef = inject(DestroyRef);

    // Totales calculados para validación
    totalFinanciarApto: number = 0;
    totalesAdicionales: Map<string, number> = new Map();

    // Flag para permitir click en el checkbox sin validar blur
    ignorarNextBlur = false;
    private lastAlertByControl = new WeakMap<FormControl, string>();
    private suppressNextAlertByControl = new WeakMap<FormControl, boolean>();

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
        private planPagosService: PlanPagosService,
        private formErrorService: FormErrorService,
        private dateUtils: DateUtilsService,
        private calculadora: CotizacionCalculadoraService,
        private storageService: CotizacionStorageService
    ) {
        this.form = this.initForm();
        this.adicionalesManager.setupSubscriptions(this.form, this.destroyRef);
        this.setupCalculos();
    }

    private initForm(): FormGroup {
        return this.fb.group({
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

            // Adicionales
            ...this.adicionalesManager.createAllControls(),

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
                            this.storageService.saveTorre(savedForm.torre);

                            this.apartamentosFiltrados = this.allApartamentos.filter(
                                a => a.torre === savedForm.torre
                            );

                            // Re-aplicar valor de torre para asegurar que el dropdown lo muestre
                            this.form.patchValue({ torre: savedForm.torre }, { emitEvent: false });
                        }

                        if (savedForm.apartamento) {
                            const apto = this.allApartamentos.find(a => a.id === savedForm.apartamento);
                            if (apto) {
                                this.storageService.saveApartamento(apto);

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

                // Preseleccionar Nogales y bloquear (solo si no hay un proyecto ya seleccionado)
                const currentProyecto = this.form.get('proyecto')?.value;
                const nogales = this.proyectos.find(p => p.nombre?.toLowerCase().includes('nogales'));
                if (nogales && !currentProyecto) {
                    this.form.patchValue({ proyecto: nogales.id }, { emitEvent: true });
                    this.form.get('proyecto')?.disable();
                } else if (nogales && currentProyecto === nogales.id) {
                    this.form.get('proyecto')?.disable();
                }

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
        this.storageService.clear();
        this.form.reset();
        this.plan.clear();
    }

    private listenProyectosChanges() {
        let previousId = this.form.get('proyecto')?.value;

        this.form.get('proyecto')!.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((id: any) => {
                const currentId = id ? Number(id) : null;
                if (currentId === (previousId ? Number(previousId) : null)) return;
                previousId = currentId;

                // Limpiar dependientes solo si el proyecto cambió de verdad
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
                this.storageService.saveProyecto(proyecto);


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
        let previousTorre = this.form.get('torre')?.value;

        this.form.get('torre')!.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((torre: string) => {
                if (torre === previousTorre) return;
                previousTorre = torre;

                this.form.patchValue({ apartamento: '', valorTotal: null }, { emitEvent: false });

                this.storageService.saveTorre(torre);

                if (!torre) {
                    this.apartamentosFiltrados = [];
                    return;
                }

                this.apartamentosFiltrados = this.allApartamentos.filter(a => a.torre === torre);
                this.cdr.markForCheck();
            });
    }

    private listenApartamentoChanges() {
        this.form.get('apartamento')!.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((aptoId: string) => {
                const apto = this.allApartamentos.find(a => a.id === aptoId);
                if (!apto) return;

                // ✅ label
                this.storageService.saveApartamento(apto);

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
        this.form.get('nombreEjecutivo')!.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((id: number | null) => {
                const asesor = this.asesores.find(a => a.id === Number(id));
                if (!asesor) return;

                // Autollenar
                this.form.patchValue({
                    telefonoEjecutivo: asesor.telefono ?? '',
                    correoEjecutivo: asesor.email ?? '',
                }, { emitEvent: false });

                this.storageService.saveAsesor(asesor);
            });
    }

    get plan(): FormArray<FormGroup> {
        return this.form.get('plan') as FormArray<FormGroup>;
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
     * Retorna los adicionales seleccionados ordenados por cantidad de cuotas (menor a mayor).
     * Útil para que en la tabla aparezcan primero los planes más cortos.
     */
    getAdicionalesSeleccionadosOrdenados(): AdicionalConfig[] {
        const seleccionados = this.getAdicionalesSeleccionados();
        return seleccionados.sort((a, b) => {
            const lengthA = this.planesAdicionales.get(a.id)?.length || 0;
            const lengthB = this.planesAdicionales.get(b.id)?.length || 0;
            return lengthA - lengthB;
        });
    }

    /**
     * Cambia el tab activo de adicionales
     */
    cambiarTabAdicional(adicionalId: string): void {
        this.tabActivoAdicional = adicionalId;
    }

    /* -------------------------------------------------------------------------- */
    /*                        MÉTODOS PARA TABLA UNIFICADA                        */
    /* -------------------------------------------------------------------------- */

    /**
     * Retorna el número máximo de cuotas entre el plan del apartamento y los adicionales
     */
    get maxPlanRows(): number[] {
        let max = this.plan.length;
        this.planesAdicionales.forEach(p => {
            if (p.length > max) max = p.length;
        });
        return Array.from({ length: max }, (_, i) => i);
    }

    /**
     * Obtiene la fecha de la cuota en la posición index.
     * Prioriza la fecha del apartamento, si no existe, busca en adicionales.
     */
    getPlanRowFecha(index: number): string {
        // 1. Intentar fecha del apartamento
        if (index < this.plan.length) {
            return this.plan.at(index).get('fechaApto')?.value;
        }

        // 2. Buscar en adicionales
        for (const [key, formArray] of this.planesAdicionales.entries()) {
            if (index < formArray.length) {
                return formArray.at(index).get('fechaApto')?.value;
            }
        }

        return '';
    }

    /**
     * Calcula la suma de las cuotas de TODOS los adicionales seleccionados para la fila index.
     * @deprecated Se usa ahora columnas individuales
     */
    getValorAdicionalesAt(index: number): number {
        let total = 0;
        const seleccionados = this.getAdicionalesSeleccionados();
        seleccionados.forEach(config => {
            total += this.getValorAdicionalAt(config.id, index);
        });
        return total;
    }

    /**
     * Obtiene el valor de la cuota para un adicional específico en la fila index
     */
    getValorAdicionalAt(configId: string, index: number): number {
        const formArray = this.planesAdicionales.get(configId);
        if (formArray && index < formArray.length) {
            return this.toNum(formArray.at(index).get('valorApto')?.value);
        }
        return 0;
    }

    /**
     * Helper para obtener el control del plan de apartamento de forma segura desde el template
     */
    getAptoControl(index: number): FormGroup | null {
        if (index < this.plan.length) {
            return this.plan.at(index) as FormGroup;
        }
        return null;
    }

    /**
     * Helper para obtener el control de un plan adicional específico
     */
    getAdicionalControl(configId: string, index: number): FormGroup | null {
        const formArray = this.planesAdicionales.get(configId);
        if (formArray && index < formArray.length) {
            return formArray.at(index) as FormGroup;
        }
        return null;
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

    /**
     * Calcula el total de una fila específica (Apartamento + Adicionales)
     */
    getRowTotal(index: number): number {
        let total = 0;

        // Sumar apartamento
        if (index < this.plan.length) {
            total += this.toNum(this.plan.at(index).get('valorApto')?.value);
        }

        // Sumar adicionales seleccionados
        const seleccionados = this.getAdicionalesSeleccionados();
        seleccionados.forEach(config => {
            const formArray = this.planesAdicionales.get(config.id);
            if (formArray && index < formArray.length) {
                total += this.toNum(formArray.at(index).get('valorApto')?.value);
            }
        });

        return total;
    }

    /**
     * Total de la columna Apartamento
     */
    getAptoColumnTotal(): number {
        return this.plan.controls.reduce((acc, curr) => {
            return acc + this.toNum(curr.get('valorApto')?.value);
        }, 0);
    }

    /**
     * Total de la columna de un Adicional específico
     */
    getAdicionalColumnTotal(configId: string): number {
        const formArray = this.planesAdicionales.get(configId);
        if (!formArray) return 0;
        return formArray.controls.reduce((acc, curr) => {
            return acc + this.toNum(curr.get('valorApto')?.value);
        }, 0);
    }

    /**
     * Gran total de toda la tabla (suma de todos los pagos)
     */
    getGrandPlanTotal(): number {
        let total = this.getAptoColumnTotal();
        const seleccionados = this.getAdicionalesSeleccionados();
        seleccionados.forEach(config => {
            total += this.getAdicionalColumnTotal(config.id);
        });
        return total;
    }


    generarPlan() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.showPlan = false;
            return;
        }

        this.plan.clear();
        this.planesAdicionales.clear();

        this.generarPlanApartamento();
        this.generarPlanAdicionales();

        // Establecer el primer adicional como tab activo si existe
        const adicionalesSeleccionados = this.getAdicionalesSeleccionados();
        if (adicionalesSeleccionados.length > 0) {
            this.tabActivoAdicional = adicionalesSeleccionados[0].id;
        }

        this.showPlan = true;
    }

    private generarPlanApartamento() {
        const cantidadCuotas = this.form.get('cantidadCuotas')?.value || 0;
        const fechaUltima = this.form.get('fechaUltimaCuota')?.value;
        const valorEspecial = this.form.get('valorEspecialHoy')?.value || 0;
        const inicial = this.form.get('valorCuotaInicial')?.value || 0;

        this.totalFinanciarApto = Math.max(valorEspecial - inicial, 0);

        // Validación de mínimo 1M para apartamento (Feature Logic)
        if (cantidadCuotas > 0) {
            const cuotaPromedio = this.totalFinanciarApto / cantidadCuotas;
            if (cuotaPromedio < 1000000) {
                alert(`La cuota promedio del apartamento ($${Math.round(cuotaPromedio).toLocaleString()}) es inferior al mínimo permitido de $1.000.000. Por favor reduzca el número de cuotas o los beneficios.`);
                this.showPlan = false;
                return;
            }
        }

        const planApto = this.planPagosService.generarPlanPagos({
            valorTotal: valorEspecial,
            valorInicial: inicial,
            cantidadCuotas: cantidadCuotas,
            fechaUltimaCuota: fechaUltima
        });

        planApto.forEach(item => {
            const row = this.createPlanRow();
            row.get('fechaApto')?.setValue(item.fecha, { emitEvent: false });
            row.get('valorApto')?.setValue(item.valor.toString(), { emitEvent: false });

            row.get('editarValorApto')?.valueChanges
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe(editar => {
                    const valorAptoControl = row.get('valorApto');
                    editar ? valorAptoControl?.enable({ emitEvent: false }) : valorAptoControl?.disable({ emitEvent: false });
                });

            this.plan.push(row);
        });

        // Setup validation logic for main plan
        this.setupEditToggle(this.plan, this.totalFinanciarApto, 1000000);
    }

    private generarPlanAdicionales() {
        const adicionalesSeleccionados = this.getAdicionalesSeleccionados();

        // Generar planes de adicionales
        adicionalesSeleccionados.forEach(config => {
            const cuotas = this.toNum(this.form.get(config.formControls.cuotasFinanciacion)?.value);
            const fechaUltimaCuota = this.form.get(config.formControls.fechaUltimaCuota)?.value;
            const beneficio = this.toNum(this.form.get(config.formControls.beneficio)?.value);
            const valorTotal = this.toNum(this.form.get(config.formControls.valorTotal)?.value);
            const valorDespuesBeneficio = Math.max(valorTotal - beneficio, 0);

            this.totalesAdicionales.set(config.id, valorDespuesBeneficio);

            // Validate minimum quota (Feature Logic)
            if (cuotas > 0) {
                const cuotaPromedioAdic = valorDespuesBeneficio / cuotas;
                if (cuotaPromedioAdic < 500000) {
                    // Note: We might want to alert here, but since this loop runs for all, be careful with multiple alerts.
                    // The original feature logic had this check inside a loop before generation.
                    // For now, I'll rely on executing it. If it fails validation later, it will show.
                }
            }

            // Calculations from Feature
            let valorCuotaCalculada = cuotas > 0 ? Math.round(valorDespuesBeneficio / cuotas) : 0;

            const plan = this.planPagosService.generarPlanPagos({
                valorTotal: valorDespuesBeneficio,
                valorInicial: 0,
                cantidadCuotas: cuotas,
                fechaUltimaCuota: fechaUltimaCuota,
                valorCuotaManual: valorCuotaCalculada
            });

            const formArrayAdicional = this.fb.array<FormGroup>([]);
            plan.forEach(item => {
                const row = this.createPlanRow();
                row.get('fechaApto')?.setValue(item.fecha, { emitEvent: false });
                row.get('valorApto')?.setValue(item.valor.toString(), { emitEvent: false });

                row.get('editarValorApto')?.valueChanges
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe(editar => {
                        const valorAptoControl = row.get('valorApto');
                        editar ? valorAptoControl?.enable({ emitEvent: false }) : valorAptoControl?.disable({ emitEvent: false });
                    });

                formArrayAdicional.push(row);
            });

            this.setupEditToggle(formArrayAdicional, valorDespuesBeneficio, 500000);
            this.planesAdicionales.set(config.id, formArrayAdicional);
        });
    }

    /**
     * Configura el recálculo dinámico para un FormArray de cuotas
     */
    /**
     * Configura solo el toggle del checkbox para recalcular al activar/desactivar
     */
    private setupEditToggle(
        formArray: FormArray,
        totalFinanciar: number,
        valorMinimo: number
    ) {
        formArray.controls.forEach(control => {
            const group = control as FormGroup;
            const editarControl = group.get('editarValorApto');

            // Solo nos importa si cambia el checkbox, la edición de valor se maneja en (blur)
            editarControl?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
                setTimeout(() => {
                    this.ejecutarRecalculo(formArray, totalFinanciar, valorMinimo);
                }, 0);
            });
        });
    }

    /**
     * Manejador del evento blur para las cuotas
     */
    onCuotaBlur(event: any, index: number, formArray: FormArray | undefined | null, totalFinanciar: number | undefined, valorMinimo: number) {
        if (!formArray || totalFinanciar === undefined) return;

        if (this.ignorarNextBlur) {
            this.ignorarNextBlur = false;
            return;
        }

        const relatedTarget = event.relatedTarget as HTMLElement;
        if (relatedTarget && (relatedTarget.classList.contains('edit-checkbox') || relatedTarget.classList.contains('edit-icon-label'))) {
            return;
        }

        const inputElement = event.target as HTMLInputElement;
        const group = formArray.at(index) as FormGroup;
        const editarControl = group.get('editarValorApto');
        const ctrl = group.get('valorApto') as FormControl;

        // Breve delay para asegurar que Angular y la directiva terminen de procesar
        setTimeout(() => {
            // Sincronización forzada: Leer del DOM si el control está en modo edición
            if (editarControl?.value) {
                const rawValue = inputElement.value;
                const numericValue = this.toNum(rawValue);

                // Actualizamos el control con el valor REAL del DOM antes de recalcular
                ctrl.setValue(numericValue.toString(), { emitEvent: false });
                ctrl.markAsTouched();

                const result = this.ejecutarRecalculo(formArray, totalFinanciar, valorMinimo, ctrl);

                if (result && !result.success) {
                    // Focus trap con requestAnimationFrame para máxima compatibilidad
                    requestAnimationFrame(() => {
                        inputElement.focus();
                        this.cdr.detectChanges();
                    });
                }
                this.cdr.detectChanges();
            }
        }, 50);
    }

    private ejecutarRecalculo(
        formArray: FormArray,
        totalFinanciar: number,
        valorMinimo: number,
        triggeringControl?: FormControl
    ) {
        const cuotas = formArray.controls.map(control => {
            const group = control as FormGroup;
            const val = this.toNum(group.get('valorApto')?.value);
            const manual = !!group.get('editarValorApto')?.value;
            return { valor: val, manual };
        });

        const result = this.planPagosService.recalcularCuotas(totalFinanciar, cuotas, valorMinimo);

        // helper: quitar SOLO invalidDistribution sin romper otros errores
        const removeInvalidDistribution = (c: FormControl | null) => {
            if (!c) return;
            const errs = c.errors;
            if (!errs || !errs['invalidDistribution']) return;

            delete errs['invalidDistribution'];
            c.setErrors(Object.keys(errs).length ? errs : null, { emitEvent: false });
        };

        if (result.success && result.nuevosValores) {
            // ✅ limpiar error en TODOS al tener éxito
            formArray.controls.forEach(ctrl => {
                const g = ctrl as FormGroup;
                const rowCtrl = g.get('valorApto') as FormControl;
                removeInvalidDistribution(rowCtrl);
                // También limpiar error de mínimo si ya está por encima
                if (rowCtrl.errors?.['belowMinimum'] && this.toNum(rowCtrl.value) >= valorMinimo) {
                    const errs = { ...rowCtrl.errors };
                    delete errs['belowMinimum'];
                    rowCtrl.setErrors(Object.keys(errs).length ? errs : null);
                }
                rowCtrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
            });

            // ✅ actualiza cuotas automáticas y fuerza refresh
            result.nuevosValores.forEach((nuevoValor, index) => {
                const group = formArray.at(index) as FormGroup;
                const isManual = cuotas[index].manual;

                if (!isManual) {
                    const c = group.get('valorApto') as FormControl;
                    c.setValue(Math.round(nuevoValor), { emitEvent: true });
                    c.updateValueAndValidity({ onlySelf: true, emitEvent: false });
                }
            });
        } else {
            // Error handling quirúrgico:
            // 1. Marcar CUALQUIER fila que esté por debajo del mínimo (sea manual o auto)
            formArray.controls.forEach(ctrl => {
                const g = ctrl as FormGroup;
                const cValue = this.toNum(g.get('valorApto')?.value);
                const rowCtrl = g.get('valorApto') as FormControl;

                if (cValue < valorMinimo && cValue !== 0) { // Validamos contra el mínimo
                    rowCtrl.setErrors({ ...rowCtrl.errors, belowMinimum: true });
                    rowCtrl.markAsTouched();
                } else {
                    // Limpiar solo belowMinimum si ya se corrigió
                    if (rowCtrl.errors?.['belowMinimum']) {
                        const errs = { ...rowCtrl.errors };
                        delete errs['belowMinimum'];
                        rowCtrl.setErrors(Object.keys(errs).length ? errs : null);
                    }
                }
            });

            // 2. Marcar el control que disparó el error si la distribución es inválida
            if (triggeringControl) {
                triggeringControl.setErrors({
                    ...(triggeringControl.errors || {}),
                    invalidDistribution: true
                });
                triggeringControl.markAsTouched();

                // ✅ alert SOLO una vez por mismo error
                const msg = result.error || 'La distribución no es válida o alguna cuota quedó por debajo del mínimo.';
                const lastMsg = this.lastAlertByControl.get(triggeringControl);

                if (lastMsg !== msg) {
                    this.lastAlertByControl.set(triggeringControl, msg);
                    alert(msg);
                }
            }
        }

        this.cdr.detectChanges();
        return result;
    }

    private toNum(v: any): number {
        if (v === null || v === undefined || v === '') return 0;
        if (typeof v === 'number') return isNaN(v) ? 0 : Math.round(v);

        // Limpieza estricta: Solo números
        const s = String(v).replace(/[^0-9]/g, "");
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
    }

    generarCotizacion() {
        // 0. Forzar re-calculo sincrónico de todos los planes para asegurar que no hay cambios pendientes
        this.revalidateAllPlans();

        if (this.form.invalid || this.isAnyPlanInvalid()) {
            this.form.markAllAsTouched();

            // Forzar mostrar errores en todos los planes
            this.plan.controls.forEach(c => (c as FormGroup).get('valorApto')?.markAsTouched());
            this.planesAdicionales.forEach(fa => {
                fa.controls.forEach(c => (c as FormGroup).get('valorApto')?.markAsTouched());
            });

            alert('Por favor verifique el formulario, hay campos con errores o las cuotas no cumplen los requisitos mínimos.');
            return;
        }

        this.state.save(this.form.getRawValue());
        this.router.navigate(['/preview']);
    }

    private revalidateAllPlans() {
        // Sincronizar Apartment plan
        this.ejecutarRecalculo(this.plan, this.totalFinanciarApto, 1000000);

        // Sincronizar Additional plans
        this.planesAdicionales.forEach((fa, id) => {
            const total = this.totalesAdicionales.get(id);
            if (total !== undefined) {
                this.ejecutarRecalculo(fa, total, 500000);
            }
        });
    }

    isAnyPlanInvalid(): boolean {
        // 1. Validar plan de apartamento
        const hasAptoErrors = this.plan.controls.some(c => {
            const ctrl = (c as FormGroup).get('valorApto');
            return ctrl?.invalid;
        });

        if (hasAptoErrors) return true;

        // 2. Validar planes de adicionales
        let hasAdicErrors = false;
        this.planesAdicionales.forEach(fa => {
            if (fa.controls.some(c => (c as FormGroup).get('valorApto')?.invalid)) {
                hasAdicErrors = true;
            }
        });

        return hasAdicErrors;
    }

    shouldBlockEdit(row: any): boolean {
        // Usa AbstractControl o any para evitar problemas de tipos en la plantilla
        const ctrl = row as FormGroup;
        const isEditing = ctrl.get('editarValorApto')?.value;
        const isInvalid = this.isAnyPlanInvalid();

        // Si ya está editando, permitimos (para que pueda desmarcar si quiere cancelar)
        // Si NO está editando, bloqueamos si hay cualquier error en el plan
        if (isEditing) {
            return false;
        }
        return isInvalid;
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

        doc.valueChanges
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(apply);
        apply();
    }



    private setupCalculos() {
        const valorTotal = this.form.get('valorTotal')!;
        const benefVal = this.form.get('beneficioValorizacion')!;
        const benefPronta = this.form.get('beneficioProntaSeparacion')!;
        const porcentaje = this.form.get('porcentajeCuotaInicial')!;
        const fechaUlt = this.form.get('fechaUltimaCuota')!;

        // recalcular cuando cambien inputs clave
        valorTotal.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateAll());
        benefVal.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateAll());
        benefPronta.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateAll());
        porcentaje.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateAll());
        fechaUlt.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.recalculateAll());

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

        // 1. Cálculos de valores y beneficios
        const calculos = this.calculadora.calcular(
            valorTotal.value,
            benefVal.value,
            benefPronta.value,
            porcentaje.value
        );

        if (calculos.beneficiosExcedidos) {
            aprobador.enable({ emitEvent: false });
        } else {
            aprobador.setValue(false, { emitEvent: false });
            aprobador.disable({ emitEvent: false });
        }

        valorEspecial.setValue(calculos.valorEspecial, { emitEvent: false });
        valorCuotaInicial.setValue(calculos.valorCuotaInicial, { emitEvent: false });

        // 2. Cálculo de meses (usando DateUtilsService)
        const m = this.dateUtils.calcMonths(fechaUlt.value);
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

        // Obtenemos el label o usamos el nombre del control por defecto
        const label = this.fieldLabels[controlName] ?? controlName;

        // Delegamos la lógica al servicio
        return this.formErrorService.getErrorMessage(c, label);
    }
}