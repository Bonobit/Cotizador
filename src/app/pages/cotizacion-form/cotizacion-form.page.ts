import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DestroyRef } from '@angular/core';
import {
    FormArray,
    FormBuilder,
    FormControl,
    FormGroup,
    ReactiveFormsModule,
    Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { CotizacionStateService } from '../../shared/services/cotizacion-state.service';
import { AsesoresService, Asesor } from '../../shared/services/asesores.service';
import { ProyectosService, Proyectos } from '../../shared/services/proyectos.service';

@Component({
    selector: 'app-cotizacion-form-page',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule],
    templateUrl: './cotizacion-form.page.html',
    styleUrls: ['./cotizacion-form.page.css'],
})

export class CotizacionFormPage implements OnInit {
    showPlan = false;

    form!: FormGroup;
    asesores: Asesor[] = [];
    cargandoAsesores = false;
    proyectos: Proyectos[] = [];
    cargandoProyectos = false;
    errorAsesores = '';
    errorProyectos = '';

    constructor(
        private fb: FormBuilder,
        private router: Router,
        private asesoresService: AsesoresService,
        private proyectosService: ProyectosService,
        private state: CotizacionStateService,
        private destroyRef: DestroyRef,
        private cdr: ChangeDetectorRef
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

            valorTotal: [null, Validators.required],
            beneficioValorizacion: [0, Validators.required],
            beneficioProntaSeparacion: [0, Validators.required],

            valorEspecialHoy: [{ value: null, disabled: true }],

            porcentajeCuotaInicial: [20, Validators.required],
            valorCuotaInicial: [{ value: null, disabled: true }],

            fechaUltimaCuota: ['', Validators.required],
            cantidadCuotas: [{ value: '0', disabled: true }],


            parqueadero: [false],
            cantidadParqueaderos: [{ value: '0', disabled: true }],

            kitAcabados: [false],
            kitDomotica: [false],


            valorTotalAdicionales: [0],
            cuotasFinanciacion: [0],
            fechaUltimaCuotaAdic: [''],


            nombreEjecutivo: [null, [Validators.required]],
            telefonoEjecutivo: ['', [
                Validators.required,
                Validators.maxLength(10),
                Validators.pattern(/^[0-9]{1,10}$/)
            ]],

            correoEjecutivo: ['', [Validators.required, Validators.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/)]],

            conceptoCiudadViva: [false],
            actividadesProyecto: [false],
            link360: [false],
            cotizacionDolares: [false],
            cotizacionValidaHasta: ['', Validators.required],

            plan: this.fb.array([]),
        });

        const saved = localStorage.getItem('cotizacionNo');
        this.cotizacionNo = saved ? Number(saved) : 1;
        this.setupParqueaderoRule();
        this.setupCalculos();
    }

    ngOnInit() {
        this.cargarAsesores();
        this.listenEjecutivoChanges();

        this.cargarProyectos();
        this.listenProyectosChanges();

        // ✅ Restaurar estado si venimos del preview
        const savedForm = this.state.load<any>();
        if (savedForm) {
            // valores simples
            this.form.patchValue(savedForm, { emitEvent: false });

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
            const proyecto = this.proyectos.find(a => a.id === Number(id));
            if (!proyecto) return;

            // Autollenar
            this.form.patchValue({
            }, { emitEvent: false });

            localStorage.setItem('proyecto_nombre', proyecto.nombre ?? '');
            localStorage.setItem('proyecto_logo', proyecto.logo_url ?? '');
            localStorage.setItem('proyecto_recorrido', proyecto.link_recorrido_360 ?? '');
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
        const cantidadCuotas = this.form.get('cantidadCuotas')?.value;
        for (let i = 0; i < cantidadCuotas; i++) this.plan.push(this.createPlanRow());
        this.showPlan = true;
    }

    generarCotizacion() {

        this.state.save(this.form.getRawValue());

        this.cotizacionNo += 1;

        localStorage.setItem('cotizacionNo', String(this.cotizacionNo));

        this.router.navigate(['/preview']);
    }

    isInvalid(name: string): boolean {
        const c = this.form.get(name);
        return !!c && !c.disabled && c.invalid && (c.touched || c.dirty);
    }

    cotizacionNo = 1;

    get cotizacionNoLabel(): string {
        return String(this.cotizacionNo).padStart(4, '0');
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

    private setupParqueaderoRule() {
        const parqueadero = this.form.get('parqueadero')!;
        const cantidad = this.form.get('cantidadParqueaderos')!;

        parqueadero.valueChanges.subscribe((checked: boolean) => {
            if (checked) {
                cantidad.enable({ emitEvent: false });
                if (!cantidad.value) cantidad.setValue('1', { emitEvent: false });
            } else {
                cantidad.setValue('0', { emitEvent: false });
                cantidad.disable({ emitEvent: false });
            }
        });

        if (!parqueadero.value) {
            cantidad.setValue('0', { emitEvent: false });
            cantidad.disable({ emitEvent: false });
        }
    }

    private setupCalculos() {
        const valorTotal = this.form.get('valorTotal')!;
        const benefVal = this.form.get('beneficioValorizacion')!;
        const benefPronta = this.form.get('beneficioProntaSeparacion')!;
        const valorEspecial = this.form.get('valorEspecialHoy')!;
        const porcentaje = this.form.get('porcentajeCuotaInicial')!;
        const valorCuotaInicial = this.form.get('valorCuotaInicial')!;
        const fechaUlt = this.form.get('fechaUltimaCuota')!;
        const cantCuotas = this.form.get('cantidadCuotas')!;

        const toNum = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0);

        const recalc = () => {
            const vt = toNum(valorTotal.value);
            const bv = toNum(benefVal.value);
            const bp = toNum(benefPronta.value);
            const porcentajeBeneficio = 0.5;
            const maxBeneficio = vt * porcentajeBeneficio;
            const totalBeneficios = bv + bp;

            if (totalBeneficios > maxBeneficio) {
                // Marcar erroen los controles
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

            // Cantidad de cuotas = meses desde (hoy + 1 mes) hasta fechaUltimaCuota
            const f = fechaUlt.value ? new Date(fechaUlt.value) : null;
            if (!f || isNaN(f.getTime())) {
                cantCuotas.setValue(null, { emitEvent: false });
                return;
            }

            const start = new Date();
            start.setMonth(start.getMonth() + 1);
            start.setDate(1); // opcional: alinear al mes

            const months =
                (f.getFullYear() - start.getFullYear()) * 12 +
                (f.getMonth() - start.getMonth()) + 1;

            cantCuotas.setValue(Math.max(months, 0), { emitEvent: false });
        };

        // recalcular cuando cambien inputs clave
        valorTotal.valueChanges.subscribe(recalc);
        benefVal.valueChanges.subscribe(recalc);
        benefPronta.valueChanges.subscribe(recalc);
        porcentaje.valueChanges.subscribe(recalc);
        fechaUlt.valueChanges.subscribe(recalc);

        recalc();
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

        if (c.hasError('maxlength')) {
            const req = c.getError('maxlength')?.requiredLength;
            return `El campo "${label}" debe tener máximo ${req} caracteres.`;
        }

        if (c.hasError('minlength')) {
            const req = c.getError('minlength')?.requiredLength;
            return `El campo "${label}" debe tener mínimo ${req} caracteres.`;
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