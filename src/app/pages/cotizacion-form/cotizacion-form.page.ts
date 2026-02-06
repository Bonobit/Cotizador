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
        localStorage.clear();
        sessionStorage.clear();
        this.form.reset();
        this.plan.clear();
    }

    private listenProyectosChanges() {
        let previousId = this.form.get('proyecto')?.value;

        this.form.get('proyecto')!.valueChanges.subscribe((id: any) => {
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
        let previousTorre = this.form.get('torre')?.value;

        this.form.get('torre')!.valueChanges.subscribe((torre: string) => {
            if (torre === previousTorre) return;
            previousTorre = torre;

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

        // 1. Validar y Generar plan del apartamento
        const cantidadCuotas = this.form.get('cantidadCuotas')?.value || 0;
        const fechaUltima = this.form.get('fechaUltimaCuota')?.value;
        const valorEspecial = this.form.get('valorEspecialHoy')?.value || 0;
        const inicial = this.form.get('valorCuotaInicial')?.value || 0;

        this.totalFinanciarApto = Math.max(valorEspecial - inicial, 0);

        // Validación de mínimo 1M para apartamento
        if (cantidadCuotas > 0) {
            const cuotaPromedio = this.totalFinanciarApto / cantidadCuotas;
            if (cuotaPromedio < 1000000) {
                alert(`La cuota promedio del apartamento ($${Math.round(cuotaPromedio).toLocaleString()}) es inferior al mínimo permitido de $1.000.000. Por favor reduzca el número de cuotas o los beneficios.`);
                this.showPlan = false;
                return;
            }
        }

        // 2. Validar adicionales antes de generar nada
        const adicionalesSeleccionados = this.getAdicionalesSeleccionados();
        for (const config of adicionalesSeleccionados) {
            const cuotas = this.toNum(this.form.get(config.formControls.cuotasFinanciacion)?.value);
            const valorTotal = this.toNum(this.form.get(config.formControls.valorTotal)?.value);
            const beneficio = this.toNum(this.form.get(config.formControls.beneficio)?.value);
            const valorDespuesBeneficio = Math.max(valorTotal - beneficio, 0);

            if (cuotas > 0) {
                const cuotaPromedioAdic = valorDespuesBeneficio / cuotas;
                if (cuotaPromedioAdic < 500000) {
                    alert(`La cuota para el adicional "${config.displayName}" ($${Math.round(cuotaPromedioAdic).toLocaleString()}) es inferior al mínimo permitido de $500.000.`);
                    this.showPlan = false;
                    return;
                }
            }
        }

        // Si todas las validaciones pasan, procedemos a generar
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

        this.setupEditToggle(this.plan, this.totalFinanciarApto, 1000000);

        // Generar planes de adicionales
        adicionalesSeleccionados.forEach(config => {
            const cuotas = this.toNum(this.form.get(config.formControls.cuotasFinanciacion)?.value);
            const fechaUltimaCuota = this.form.get(config.formControls.fechaUltimaCuota)?.value;
            const beneficio = this.toNum(this.form.get(config.formControls.beneficio)?.value);
            const valorTotal = this.toNum(this.form.get(config.formControls.valorTotal)?.value);
            const valorDespuesBeneficio = Math.max(valorTotal - beneficio, 0);

            this.totalesAdicionales.set(config.id, valorDespuesBeneficio);

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

            this.setupEditToggle(formArrayAdicional, valorDespuesBeneficio, 500000);
            this.planesAdicionales.set(config.id, formArrayAdicional);
        });

        // 3. Establecer el primer adicional como tab activo
        if (adicionalesSeleccionados.length > 0) {
            this.tabActivoAdicional = adicionalesSeleccionados[0].id;
        }

        this.showPlan = true;
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
            editarControl?.valueChanges.subscribe(() => {
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
        if (typeof v === 'number') return v;

        // Limpieza robusta: Quita todo excepto números y puntos/comas
        // Luego maneja el formato decimal (en Colombia suele ser punto para miles, pero la directiva usa comas para visual)
        let s = String(v).replace(/[^0-9,.-]+/g, "");

        // Si hay una coma al final (como en "1.000,"), la quitamos
        if (s.endsWith(',')) s = s.slice(0, -1);

        // Reemplazamos comas por nada (asumiendo que son separadores de miles o decimales incompletos)
        // en este sistema trabajamos con enteros para pesos colombianos mayormente
        s = s.replace(/,/g, "");

        return Number(s) || 0;
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


        const vt = this.toNum(valorTotal.value);
        const bv = this.toNum(benefVal.value);
        const bp = this.toNum(benefPronta.value);
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
        const p = this.toNum(porcentaje.value);
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