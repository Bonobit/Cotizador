import { Injectable, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AdicionalConfig } from '@core/models/adicional-config.model';

/**
 * Configuración de todos los tipos de adicionales
 */
export const ADICIONALES_CONFIG: AdicionalConfig[] = [
    {
        id: 'parqueadero',
        displayName: 'Parqueadero',
        hasQuantity: true,
        formControls: {
            checkbox: 'parqueadero',
            cantidad: 'cantidadParqueaderos',
            valorTotal: 'valorTotalParqueaderos',
            beneficio: 'beneficioParqueadero',
            valorCuota: 'valorCuotaParqueadero',
            fechaUltimaCuota: 'fechaUltimaCuotaParqueadero',
            cuotasFinanciacion: 'cuotasFinanciacionParqueadero'
        }
    },
    {
        id: 'kitAcabados',
        displayName: 'Kit de Acabados',
        hasQuantity: false,
        formControls: {
            checkbox: 'kitAcabados',
            valorTotal: 'valorTotalKitAcabados',
            beneficio: 'beneficioKitAcabados',
            valorCuota: 'valorCuotaKitAcabados',
            fechaUltimaCuota: 'fechaUltimaCuotaKitAcabados',
            cuotasFinanciacion: 'cuotasFinanciacionKitAcabados'
        }
    },
    {
        id: 'kitDomotica',
        displayName: 'Kit de Domótica',
        hasQuantity: false,
        formControls: {
            checkbox: 'kitDomotica',
            valorTotal: 'valorTotalKitDomotica',
            beneficio: 'beneficioKitDomotica',
            valorCuota: 'valorCuotaKitDomotica',
            fechaUltimaCuota: 'fechaUltimaCuotaKitDomotica',
            cuotasFinanciacion: 'cuotasFinanciacionKitDomotica'
        }
    },
    {
        id: 'deposito',
        displayName: 'Depósito',
        hasQuantity: false,
        formControls: {
            checkbox: 'deposito',
            valorTotal: 'valorTotalDeposito',
            beneficio: 'beneficioDeposito',
            valorCuota: 'valorCuotaDeposito',
            fechaUltimaCuota: 'fechaUltimaCuotaDeposito',
            cuotasFinanciacion: 'cuotasFinanciacionDeposito'
        }
    }
];

import { DateUtilsService } from '@core/services/date-utils.service';

@Injectable({
    providedIn: 'root'
})
export class AdicionalesManagerService {

    constructor(
        private fb: FormBuilder,
        private dateUtils: DateUtilsService
    ) { }

    /**
     * Obtiene todas las configuraciones de adicionales
     */
    getAdicionalesConfig(): AdicionalConfig[] {
        return ADICIONALES_CONFIG;
    }

    /**
     * Obtiene la configuración de un adicional específico por su ID
     */
    getConfigById(id: string): AdicionalConfig | undefined {
        return ADICIONALES_CONFIG.find(config => config.id === id);
    }

    /**
     * Genera los controles de formulario para un adicional específico
     */
    createFormControls(config: AdicionalConfig): { [key: string]: any } {
        const controls: { [key: string]: any } = {
            [config.formControls.checkbox]: [false],
            [config.formControls.valorTotal]: [{ value: 0, disabled: true }],
            [config.formControls.beneficio]: [{ value: 0, disabled: true }],
            [config.formControls.valorCuota]: [{ value: 0, disabled: true }],
            [config.formControls.fechaUltimaCuota]: [{ value: '', disabled: true }],
            [config.formControls.cuotasFinanciacion]: [{ value: 0, disabled: true }]
        };

        // Agregar campo de cantidad si es necesario
        if (config.hasQuantity && config.formControls.cantidad) {
            controls[config.formControls.cantidad] = [{ value: '0', disabled: true }];
        }

        return controls;
    }

    /**
     * Actualiza el estado de los controles de un adicional basado en si está seleccionado
     * Cuando se selecciona, habilita campos y añade validadores required
     * Cuando se deselecciona, deshabilita campos y elimina validadores
     */
    updateAdicionalState(form: FormGroup, config: AdicionalConfig): void {
        const checkboxControl = form.get(config.formControls.checkbox);
        const isSelected = checkboxControl?.value || false;

        const controls = {
            cantidad: config.formControls.cantidad ? form.get(config.formControls.cantidad) : null,
            valorTotal: form.get(config.formControls.valorTotal),
            beneficio: form.get(config.formControls.beneficio),
            valorCuota: form.get(config.formControls.valorCuota),
            fechaUltimaCuota: form.get(config.formControls.fechaUltimaCuota),
            cuotasFinanciacion: form.get(config.formControls.cuotasFinanciacion)
        };

        if (isSelected) {
            // Habilitar campos y añadir validadores when el adicional está seleccionado
            if (config.hasQuantity && controls.cantidad) {
                controls.cantidad.enable({ emitEvent: false });
                controls.cantidad.setValidators([Validators.required]);
                controls.cantidad.updateValueAndValidity({ emitEvent: false });
                // Marcar como pristine para evitar mostrar errores inmediatamente
                controls.cantidad.markAsPristine();
                controls.cantidad.markAsUntouched();
                if (!controls.cantidad.value || controls.cantidad.value === '0') {
                    controls.cantidad.setValue('1', { emitEvent: false });
                }
            }

            // Valor total es obligatorio
            controls.valorTotal?.enable({ emitEvent: false });
            controls.valorTotal?.setValidators([Validators.required, Validators.min(1)]);
            controls.valorTotal?.updateValueAndValidity({ emitEvent: false });
            controls.valorTotal?.markAsPristine();
            controls.valorTotal?.markAsUntouched();

            // Beneficio es obligatorio (puede ser 0)
            controls.beneficio?.enable({ emitEvent: false });
            controls.beneficio?.setValidators([Validators.required]);
            controls.beneficio?.updateValueAndValidity({ emitEvent: false });
            controls.beneficio?.markAsPristine();
            controls.beneficio?.markAsUntouched();

            // Fecha última cuota es obligatoria
            controls.fechaUltimaCuota?.enable({ emitEvent: false });
            controls.fechaUltimaCuota?.setValidators([Validators.required]);
            controls.fechaUltimaCuota?.updateValueAndValidity({ emitEvent: false });
            controls.fechaUltimaCuota?.markAsPristine();
            controls.fechaUltimaCuota?.markAsUntouched();

            // valorCuota y cuotasFinanciacion son calculados, no requieren validación manual
            // pero sí mantienen su estado disabled
        } else {
            // Deshabilitar, limpiar campos y eliminar validadores cuando el adicional no está seleccionado
            if (config.hasQuantity && controls.cantidad) {
                controls.cantidad.setValue('0', { emitEvent: false });
                controls.cantidad.clearValidators();
                controls.cantidad.updateValueAndValidity({ emitEvent: false });
                controls.cantidad.disable({ emitEvent: false });
            }

            controls.valorTotal?.setValue(0, { emitEvent: false });
            controls.valorTotal?.clearValidators();
            controls.valorTotal?.updateValueAndValidity({ emitEvent: false });
            controls.valorTotal?.disable({ emitEvent: false });

            controls.beneficio?.setValue(0, { emitEvent: false });
            controls.beneficio?.clearValidators();
            controls.beneficio?.updateValueAndValidity({ emitEvent: false });
            controls.beneficio?.disable({ emitEvent: false });

            controls.valorCuota?.setValue(0, { emitEvent: false });
            controls.valorCuota?.disable({ emitEvent: false });

            controls.fechaUltimaCuota?.setValue('', { emitEvent: false });
            controls.fechaUltimaCuota?.clearValidators();
            controls.fechaUltimaCuota?.updateValueAndValidity({ emitEvent: false });
            controls.fechaUltimaCuota?.disable({ emitEvent: false });

            controls.cuotasFinanciacion?.setValue(0, { emitEvent: false });
        }
    }

    /**
     * Calcula el valor de la cuota para un adicional
     */
    calculateValorCuota(form: FormGroup, config: AdicionalConfig): void {
        const valorTotalControl = form.get(config.formControls.valorTotal);
        const beneficioControl = form.get(config.formControls.beneficio);
        const cuotasControl = form.get(config.formControls.cuotasFinanciacion);
        const valorCuotaControl = form.get(config.formControls.valorCuota);

        if (!valorTotalControl || !cuotasControl || !valorCuotaControl) return;

        const toNum = (v: any) => (v === null || v === undefined || v === '' ? 0 : Number(String(v).replace(/[^0-9.-]+/g, "")) || 0);

        const valorTotal = toNum(valorTotalControl.value);
        const beneficio = beneficioControl ? toNum(beneficioControl.value) : 0;
        const cuotas = toNum(cuotasControl.value);

        let valorCuota = 0;
        if (cuotas > 0) {
            const valorFinanciar = Math.max(valorTotal - beneficio, 0);
            valorCuota = Math.round(valorFinanciar / cuotas);
        }

        valorCuotaControl.setValue(valorCuota, { emitEvent: false });
    }

    /**
     * Calcula las cuotas de financiación para un adicional basado en su fecha última de cuota
     */
    calculateCuotasFinanciacion(form: FormGroup, config: AdicionalConfig): void {
        const fechaControl = form.get(config.formControls.fechaUltimaCuota);
        const cuotasControl = form.get(config.formControls.cuotasFinanciacion);

        if (!fechaControl || !cuotasControl) return;

        const fechaStr = fechaControl.value;
        // Usar el servicio de utilidad
        const months = this.dateUtils.calcMonths(fechaStr);

        cuotasControl.setValue(months, { emitEvent: false });

        // Recalcular valor cuota ya que cambiaron las cuotas
        this.calculateValorCuota(form, config);
    }
    /**
     * Genera los controles para TODOS los adicionales configurados
     */
    createAllControls(): { [key: string]: any } {
        let controls: { [key: string]: any } = {};
        this.getAdicionalesConfig().forEach(config => {
            const adicControls = this.createFormControls(config);
            controls = { ...controls, ...adicControls };
        });
        return controls;
    }

    /**
     * Configura las suscripciones para validar y calcular automáticamente
     * @param form El formulario principal
     * @param destroyRef Referencia para destruir suscripciones automáticamente
     */
    setupSubscriptions(form: FormGroup, destroyRef: DestroyRef) {
        this.getAdicionalesConfig().forEach(config => {
            // Checkbox changes
            const checkboxControl = form.get(config.formControls.checkbox);
            if (checkboxControl) {
                checkboxControl.valueChanges
                    .pipe(takeUntilDestroyed(destroyRef))
                    .subscribe(() => {
                        this.updateAdicionalState(form, config);
                    });
            }

            // Fecha changes -> Cuotas calculation
            const fechaControl = form.get(config.formControls.fechaUltimaCuota);
            if (fechaControl) {
                fechaControl.valueChanges
                    .pipe(takeUntilDestroyed(destroyRef))
                    .subscribe(() => {
                        this.calculateCuotasFinanciacion(form, config);
                    });
            }

            // Recalculate Valor Cuota on total/beneficio/cuotas changes
            const triggerControls = [
                config.formControls.valorTotal,
                config.formControls.beneficio,
                config.formControls.cuotasFinanciacion
            ];

            triggerControls.forEach(controlName => {
                const ctrl = form.get(controlName);
                if (ctrl) {
                    ctrl.valueChanges
                        .pipe(takeUntilDestroyed(destroyRef))
                        .subscribe(() => {
                            this.calculateValorCuota(form, config);
                        });
                }
            });
        });

        // Aplicar estado inicial
        this.getAdicionalesConfig().forEach(config => {
            this.updateAdicionalState(form, config);
        });
    }
}
