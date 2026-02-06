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

// Refactoring helpers
import { FinancialCalculator } from './utils/financial-calculator';
import { getCotizacionErrorMessage } from './utils/form-validators';
import { PlanPagosFormManager } from './utils/plan-pagos-form-manager';


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
    get ignorarNextBlur() { return this.planManager.ignorarNextBlur; }
    set ignorarNextBlur(v: boolean) { this.planManager.ignorarNextBlur = v; }

    private planManager: PlanPagosFormManager;





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
        this.planManager = new PlanPagosFormManager(this.fb, this.planPagosService, this.cdr);
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

                        // Asegurar restauración de fecha de última cuota después de cargar apartamentos
                        if (savedForm.fechaUltimaCuota) {
                            this.form.patchValue({ fechaUltimaCuota: savedForm.fechaUltimaCuota }, { emitEvent: false });
                            this.recalculateAll();
                        }

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
                    this.form.get('proyecto')?.disable({ emitEvent: false });
                } else if (nogales && currentProyecto === nogales.id) {
                    this.form.get('proyecto')?.disable({ emitEvent: false });
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
        this.planesAdicionales.clear();
    }


    private listenProyectosChanges() {
        let previousId = this.form.get('proyecto')?.value;

        this.form.get('proyecto')!.valueChanges.subscribe((id: any) => {
            const currentId = id ? Number(id) : null;
            if (currentId === (previousId ? Number(previousId) : null)) return;

            // Si el ID previo era null, es la primera ejecución (o restauración) y no queremos limpiar
            if (previousId === undefined || previousId === null) {
                previousId = currentId;
                return;
            }

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
        return this.planManager.createPlanRow();
    }


    generarPlan() {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            this.showPlan = false;
            return;
        }

        this.plan.clear();
        this.planesAdicionales.clear();

        const cantidadCuotas = this.form.get('cantidadCuotas')?.value || 0;
        const fechaUltima = this.form.get('fechaUltimaCuota')?.value;
        const valorEspecial = this.form.get('valorEspecialHoy')?.value || 0;
        const inicial = this.form.get('valorCuotaInicial')?.value || 0;

        this.totalFinanciarApto = Math.max(valorEspecial - inicial, 0);

        if (cantidadCuotas > 0) {
            const cuotaPromedio = this.totalFinanciarApto / cantidadCuotas;
            if (cuotaPromedio < 1000000) {
                alert(`La cuota promedio del apartamento ($${Math.round(cuotaPromedio).toLocaleString()}) es inferior al mínimo permitido de $1.000.000.`);
                this.showPlan = false;
                return;
            }
        }

        const adicionalesSeleccionados = this.getAdicionalesSeleccionados();
        for (const config of adicionalesSeleccionados) {
            const cuotas = FinancialCalculator.toNum(this.form.get(config.formControls.cuotasFinanciacion)?.value);
            const valorTotal = FinancialCalculator.toNum(this.form.get(config.formControls.valorTotal)?.value);
            const beneficio = FinancialCalculator.toNum(this.form.get(config.formControls.beneficio)?.value);
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
                if (editar) valorAptoControl?.enable({ emitEvent: false });
                else valorAptoControl?.disable({ emitEvent: false });
            });

            this.plan.push(row);
        });

        this.planManager.setupEditToggle(this.plan, this.totalFinanciarApto, 1000000);

        adicionalesSeleccionados.forEach(config => {
            const cuotas = FinancialCalculator.toNum(this.form.get(config.formControls.cuotasFinanciacion)?.value);
            const fechaUltimaCuota = this.form.get(config.formControls.fechaUltimaCuota)?.value;
            const beneficio = FinancialCalculator.toNum(this.form.get(config.formControls.beneficio)?.value);
            const valorTotal = FinancialCalculator.toNum(this.form.get(config.formControls.valorTotal)?.value);
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
                    if (editar) valorAptoControl?.enable({ emitEvent: false });
                    else valorAptoControl?.disable({ emitEvent: false });
                });
                formArrayAdicional.push(row);
            });

            this.planManager.setupEditToggle(formArrayAdicional, valorDespuesBeneficio, 500000);
            this.planesAdicionales.set(config.id, formArrayAdicional);
        });

        if (adicionalesSeleccionados.length > 0) {
            this.tabActivoAdicional = adicionalesSeleccionados[0].id;
        }

        this.showPlan = true;
    }


    onCuotaBlur(event: any, index: number, formArray: FormArray | undefined | null, totalFinanciar: number | undefined, valorMinimo: number) {
        this.planManager.onCuotaBlur(event, index, formArray, totalFinanciar, valorMinimo);
    }

    private ejecutarRecalculo(formArray: FormArray, total: number, min: number, trigger?: FormControl) {
        return this.planManager.ejecutarRecalculo(formArray, total, min, trigger);
    }

    private toNum(v: any): number {
        return FinancialCalculator.toNum(v);
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
        this.planManager.ejecutarRecalculo(this.plan, this.totalFinanciarApto, 1000000);
        this.planesAdicionales.forEach((fa, id) => {
            const total = this.totalesAdicionales.get(id);
            if (total !== undefined) this.planManager.ejecutarRecalculo(fa, total, 500000);
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
        const isEditing = (row as FormGroup).get('editarValorApto')?.value;
        return !isEditing && this.isAnyPlanInvalid();
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

    recalculateAll() {
        const vt = FinancialCalculator.toNum(this.form.get('valorTotal')?.value);
        const bv = FinancialCalculator.toNum(this.form.get('beneficioValorizacion')?.value);
        const bp = FinancialCalculator.toNum(this.form.get('beneficioProntaSeparacion')?.value);
        const p = FinancialCalculator.toNum(this.form.get('porcentajeCuotaInicial')?.value);
        const fechaUlt = this.form.get('fechaUltimaCuota')?.value;

        const exceeded = FinancialCalculator.checkBeneficioExceeded(vt, bv, bp);
        const aprobador = this.form.get('aprobador')!;
        if (exceeded) aprobador.enable({ emitEvent: false });
        else {
            aprobador.setValue(false, { emitEvent: false });
            aprobador.disable({ emitEvent: false });
        }

        const especial = FinancialCalculator.calculateValorEspecial(vt, [bv, bp]);
        this.form.get('valorEspecialHoy')?.setValue(especial, { emitEvent: false });
        this.form.get('valorCuotaInicial')?.setValue(FinancialCalculator.calculateCuotaInicial(especial, p), { emitEvent: false });
        this.form.get('cantidadCuotas')?.setValue(FinancialCalculator.calcMonths(fechaUlt), { emitEvent: false });
    }

    get porcentajesCuotaInicial() {
        return Array.from({ length: 17 }, (_, i) => 20 + i * 5);
    }

    getErrorMessage(controlName: string): string {
        return getCotizacionErrorMessage(this.form, controlName);
    }
}
