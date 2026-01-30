import { Injectable } from '@angular/core';
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

@Injectable({
    providedIn: 'root'
})
export class AdicionalesManagerService {

    constructor(private fb: FormBuilder) { }

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
            // Habilitar campos cuando el adicional está seleccionado
            if (config.hasQuantity && controls.cantidad) {
                controls.cantidad.enable({ emitEvent: false });
                if (!controls.cantidad.value || controls.cantidad.value === '0') {
                    controls.cantidad.setValue('1', { emitEvent: false });
                }
            }

            controls.valorTotal?.enable({ emitEvent: false });
            controls.beneficio?.enable({ emitEvent: false });
            controls.valorCuota?.enable({ emitEvent: false });
            controls.fechaUltimaCuota?.enable({ emitEvent: false });
            // cuotasFinanciacion permanece disabled ya que es calculado
        } else {
            // Deshabilitar y limpiar campos cuando el adicional no está seleccionado
            if (config.hasQuantity && controls.cantidad) {
                controls.cantidad.setValue('0', { emitEvent: false });
                controls.cantidad.disable({ emitEvent: false });
            }

            controls.valorTotal?.setValue(0, { emitEvent: false });
            controls.valorTotal?.disable({ emitEvent: false });

            controls.beneficio?.setValue(0, { emitEvent: false });
            controls.beneficio?.disable({ emitEvent: false });

            controls.valorCuota?.setValue(0, { emitEvent: false });
            controls.valorCuota?.disable({ emitEvent: false });

            controls.fechaUltimaCuota?.setValue('', { emitEvent: false });
            controls.fechaUltimaCuota?.disable({ emitEvent: false });

            controls.cuotasFinanciacion?.setValue(0, { emitEvent: false });
        }
    }

    /**
     * Calcula las cuotas de financiación para un adicional basado en su fecha última de cuota
     */
    calculateCuotasFinanciacion(form: FormGroup, config: AdicionalConfig): void {
        const fechaControl = form.get(config.formControls.fechaUltimaCuota);
        const cuotasControl = form.get(config.formControls.cuotasFinanciacion);

        if (!fechaControl || !cuotasControl) return;

        const fechaStr = fechaControl.value;
        const months = this.calcMonths(fechaStr);

        cuotasControl.setValue(months, { emitEvent: false });
    }

    /**
     * Calcula el número de meses desde el próximo mes hasta la fecha dada
     */
    private calcMonths(dateStr: string): number | null {
        const f = dateStr ? new Date(dateStr) : null;
        if (!f || isNaN(f.getTime())) return null;

        const start = new Date();
        start.setMonth(start.getMonth() + 1);
        start.setDate(1);

        const months = (f.getFullYear() - start.getFullYear()) * 12 +
            (f.getMonth() - start.getMonth()) + 1;

        return Math.max(months, 0);
    }
}
