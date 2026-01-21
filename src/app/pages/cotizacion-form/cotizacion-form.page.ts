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

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private asesoresService: AsesoresService,
        private proyectosService: ProyectosService,
        private state: CotizacionStateService,
        private cdr: ChangeDetectorRef,
        private cotizacionesService: CotizacionesService,
        private apartamentosService: ApartamentosService
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
            apartamento: ['', Validators.required],

            valorTotal: [{ value: null, disabled: true }, Validators.required],
            beneficioValorizacion: [0, Validators.required],
            beneficioProntaSeparacion: [0, Validators.required],

            valorEspecialHoy: [{ value: null, disabled: true }],

            porcentajeCuotaInicial: [20, Validators.required],
            valorCuotaInicial: [{ value: null, disabled: true }],

            fechaUltimaCuota: ['', Validators.required],
            cantidadCuotas: [{ value: 0, disabled: true }],


            parqueadero: [false],
            cantidadParqueaderos: [{ value: '0', disabled: true }],

            kitAcabados: [false],
            kitDomotica: [false],


            valorTotalAdicionales: [0],
            cuotasFinanciacion: [{ value: 0, disabled: true }],
            fechaUltimaCuotaAdic: [''],

            nombreEjecutivo: [null, [Validators.required]],
            telefonoEjecutivo: [{ value: '', disabled: true }, [
                Validators.required,
                Validators.maxLength(10),
                Validators.pattern(/^[0-9]{1,10}$/)
            ]],

            correoEjecutivo: [{ value: '', disabled: true }, [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)]],

            conceptoCiudadViva: [false],
            actividadesProyecto: [false],
            link360: [false],
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
        const savedForm = this.state.load<any>();
        if (savedForm) {
            // valores simples
            this.form.patchValue(savedForm, { emitEvent: false });
            this.updateAdicionalesState();
            this.recalculateAll();

            // CRITICAL FIX: Restoration Logic
            // If there's a selected project, we MUST load the apartments manually
            // because patchValue with emitEvent:false won't trigger the listener
            // that normally loads them.
            if (savedForm.proyecto) {
                const proyectoId = savedForm.proyecto;
                this.cargandoApartamentos = true;

                // We need to fetch the apartments to repopulate the dropdowns
                this.apartamentosService.getApartamentosByProyecto(proyectoId).subscribe({
                    next: (data) => {
                        this.allApartamentos = data ?? [];

                        // Rebuild towers list
                        const t = new Set(this.allApartamentos.map(a => a.torre).filter(Boolean));
                        this.torres = Array.from(t).sort();

                        // Re-filter apartments if tower is selected
                        if (savedForm.torre) {
                            this.apartamentosFiltrados = this.allApartamentos.filter(a => a.torre === savedForm.torre);
                        }

                        this.cargandoApartamentos = false;
                        this.cdr.markForCheck();
                    },
                    error: (err) => {
                        console.error('Error loading apartments during restore:', err);
                        this.cargandoApartamentos = false;
                    }
                });
            }

            // restaurar plan (FormArray)
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

            const values: any = {};

            if (apto.precio_lista) {
                values.valorTotal = apto.precio_lista;
            }
            // Si hay fecha de entrega, podríamos usarla para fechaUltimaCuota?
            // El usuario puede querer cambiarla, pero podríamos sugerirla.
            // Por ahora solo valorTotal como pide la tarea principal.

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
        });
    }

    get plan(): FormArray<FormGroup> {
        return this.form.get('plan') as FormArray<FormGroup>;
    }

    get cantidadCuotasValue(): number {
        return this.form.get('cantidadCuotas')?.value || 0;
    }

    get cuotasAdicValue(): number {
        return this.form.get('cuotasFinanciacion')?.value || 0;
    }

    private createPlanRow() {
        return this.fb.group({
            fechaApto: new FormControl(''),
            valorApto: new FormControl(''),
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

        this.plan.clear();

        const cantidadCuotas = this.form.get('cantidadCuotas')?.value || 0;
        const fechaUltima = this.form.get('fechaUltimaCuota')?.value;
        const cuotasAdic = this.form.get('cuotasFinanciacion')?.value || 0;
        const fechaUltimaAdic = this.form.get('fechaUltimaCuotaAdic')?.value;

        // Calcular fechas
        const fechasApto = this.calcularFechas(cantidadCuotas, fechaUltima);
        const fechasAdic = this.calcularFechas(cuotasAdic, fechaUltimaAdic);

        // Usamos el máximo número de filas para cubrir ambos casos
        const totalRows = Math.max(cantidadCuotas, cuotasAdic);

        for (let i = 0; i < totalRows; i++) {
            const isAptoActive = i < cantidadCuotas;
            const isAdicActive = i < cuotasAdic;

            this.plan.push(this.fb.group({
                fechaApto: [{ value: isAptoActive ? (fechasApto[i] || '') : '', disabled: !isAptoActive }],
                valorApto: [{ value: '', disabled: !isAptoActive }],
                fechaAdic: [{ value: isAdicActive ? (fechasAdic[i] || '') : '', disabled: !isAdicActive }],
                valorAdic: [{ value: '', disabled: !isAdicActive }],
            }));
        }

        this.showPlan = true;
    }

    private calcularFechas(cantidad: number, fechaUltima: string): string[] {
        if (!cantidad || !fechaUltima) return [];

        const dates: string[] = [];
        // Parsear fecha 'YYYY-MM-DD'
        const parts = fechaUltima.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Mes 0-indexed
        const day = parseInt(parts[2], 10);

        for (let i = 0; i < cantidad; i++) {
            // Calculamos hacia atrás desde la última cuota
            // La fila i corresponde a (cantidad - 1 - i) meses antes de la última
            const monthsToSubtract = cantidad - 1 - i;

            // new Date maneja meses negativos correctamente (ej: mes -1 es dic del año anterior)
            const d = new Date(year, month - monthsToSubtract, 1);

            // Ajustar el día al final del mes si es necesario (ej: 31 feb -> 28 feb)
            const maxDays = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
            const finalDay = Math.min(day, maxDays);

            d.setDate(finalDay);

            // Formatear a YYYY-MM-DD para el input type="date"
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const da = String(d.getDate()).padStart(2, '0');

            dates.push(`${y}-${m}-${da}`);
        }
        return dates;
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

    private setupAdicionalesRule() {
        // Subscribers
        this.form.get('parqueadero')!.valueChanges.subscribe(() => this.updateAdicionalesState());
        this.form.get('kitAcabados')!.valueChanges.subscribe(() => this.updateAdicionalesState());
        this.form.get('kitDomotica')!.valueChanges.subscribe(() => this.updateAdicionalesState());

        // Estado inicial
        this.updateAdicionalesState();
    }

    private updateAdicionalesState() {
        const parqueadero = this.form.get('parqueadero')!;
        const kitAcabados = this.form.get('kitAcabados')!;
        const kitDomotica = this.form.get('kitDomotica')!;

        const cantidad = this.form.get('cantidadParqueaderos')!;
        const valorAdic = this.form.get('valorTotalAdicionales')!;
        const fechaAdic = this.form.get('fechaUltimaCuotaAdic')!;

        const cuotasAdic = this.form.get('cuotasFinanciacion')!;

        // 1. Lógica específica de parqueadero
        if (parqueadero.value) {
            cantidad.enable({ emitEvent: false });
            if (!cantidad.value || cantidad.value === '0') cantidad.setValue('1', { emitEvent: false });
        } else {
            cantidad.setValue('0', { emitEvent: false });
            cantidad.disable({ emitEvent: false });
        }

        // 2. Lógica global de adicionales
        const anySelected = parqueadero.value || kitAcabados.value || kitDomotica.value;

        if (anySelected) {
            if (valorAdic.disabled) valorAdic.enable({ emitEvent: false });
            if (fechaAdic.disabled) fechaAdic.enable({ emitEvent: false });
        } else {
            if (valorAdic.enabled) {
                valorAdic.setValue(0, { emitEvent: false });
                valorAdic.disable({ emitEvent: false });
            }
            if (fechaAdic.enabled) {
                fechaAdic.setValue('', { emitEvent: false });
                fechaAdic.disable({ emitEvent: false });
            }
            // También limpiar el resultado calculado
            cuotasAdic.setValue(0, { emitEvent: false });
        }
    }

    private setupCalculos() {
        const valorTotal = this.form.get('valorTotal')!;
        const benefVal = this.form.get('beneficioValorizacion')!;
        const benefPronta = this.form.get('beneficioProntaSeparacion')!;
        const porcentaje = this.form.get('porcentajeCuotaInicial')!;
        const fechaUlt = this.form.get('fechaUltimaCuota')!;
        const fechaUltAdic = this.form.get('fechaUltimaCuotaAdic')!;

        // recalcular cuando cambien inputs clave
        valorTotal.valueChanges.subscribe(() => this.recalculateAll());
        benefVal.valueChanges.subscribe(() => this.recalculateAll());
        benefPronta.valueChanges.subscribe(() => this.recalculateAll());
        porcentaje.valueChanges.subscribe(() => this.recalculateAll());
        fechaUlt.valueChanges.subscribe(() => this.recalculateAll());
        fechaUltAdic.valueChanges.subscribe(() => this.recalculateAll());

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

        const fechaUltAdic = this.form.get('fechaUltimaCuotaAdic')!;
        const cuotasAdic = this.form.get('cuotasFinanciacion')!;

        const toNum = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);

        const vt = toNum(valorTotal.value);
        const bv = toNum(benefVal.value);
        const bp = toNum(benefPronta.value);
        const porcentajeBeneficio = 0.5;
        const maxBeneficio = vt * porcentajeBeneficio;
        const totalBeneficios = bv + bp;

        if (totalBeneficios > maxBeneficio) {
            // Marcar error en los controles
            benefVal.setErrors({ benefitsExceeded: true });
            benefPronta.setErrors({ benefitsExceeded: true });
        } else {
            // Limpiar error específico si ya cumple
            if (benefVal.hasError('benefitsExceeded')) {
                benefVal.setErrors(null);
                benefVal.updateValueAndValidity({ emitEvent: false });
            }
            if (benefPronta.hasError('benefitsExceeded')) {
                benefPronta.setErrors(null);
                benefPronta.updateValueAndValidity({ emitEvent: false });
            }
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

        // Cantidad de cuotas
        const m = calcMonths(fechaUlt.value);
        cantCuotas.setValue(m, { emitEvent: false });

        // Cuotas adicionales
        const mAdic = calcMonths(fechaUltAdic.value);
        cuotasAdic.setValue(mAdic, { emitEvent: false });
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