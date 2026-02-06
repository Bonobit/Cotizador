import { ChangeDetectorRef } from '@angular/core';
import { FormArray, FormControl, FormGroup, FormBuilder } from '@angular/forms';
import { PlanPagosService } from '@core/services/plan-pagos.service';
import { FinancialCalculator } from './financial-calculator';

export class PlanPagosFormManager {
    ignorarNextBlur = false;
    private lastAlertByControl = new WeakMap<FormControl, string>();

    constructor(
        private fb: FormBuilder,
        private planPagosService: PlanPagosService,
        private cdr: ChangeDetectorRef
    ) { }

    createPlanRow() {
        return this.fb.group({
            fechaApto: new FormControl({ value: '', disabled: true }),
            valorApto: new FormControl({ value: '', disabled: true }),
            editarValorApto: new FormControl(false),
            fechaAdic: new FormControl(''),
            valorAdic: new FormControl(''),
        });
    }

    setupEditToggle(formArray: FormArray, totalFinanciar: number, valorMinimo: number) {
        formArray.controls.forEach(control => {
            const group = control as FormGroup;
            const editarControl = group.get('editarValorApto');

            editarControl?.valueChanges.subscribe(() => {
                setTimeout(() => {
                    this.ejecutarRecalculo(formArray, totalFinanciar, valorMinimo);
                }, 0);
            });
        });
    }

    ejecutarRecalculo(
        formArray: FormArray,
        totalFinanciar: number,
        valorMinimo: number,
        triggeringControl?: FormControl
    ) {
        const cuotas = formArray.controls.map(control => {
            const group = control as FormGroup;
            const val = FinancialCalculator.toNum(group.get('valorApto')?.value);
            const manual = !!group.get('editarValorApto')?.value;
            return { valor: val, manual };
        });

        const result = this.planPagosService.recalcularCuotas(totalFinanciar, cuotas, valorMinimo);

        const removeInvalidDistribution = (c: FormControl | null) => {
            if (!c) return;
            const errs = c.errors;
            if (!errs || !errs['invalidDistribution']) return;
            delete errs['invalidDistribution'];
            c.setErrors(Object.keys(errs).length ? errs : null, { emitEvent: false });
        };

        if (result.success && result.nuevosValores) {
            formArray.controls.forEach(ctrl => {
                const g = ctrl as FormGroup;
                const rowCtrl = g.get('valorApto') as FormControl;
                removeInvalidDistribution(rowCtrl);
                if (rowCtrl.errors?.['belowMinimum'] && FinancialCalculator.toNum(rowCtrl.value) >= valorMinimo) {
                    const errs = { ...rowCtrl.errors };
                    delete errs['belowMinimum'];
                    rowCtrl.setErrors(Object.keys(errs).length ? errs : null);
                }
                rowCtrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
            });

            result.nuevosValores.forEach((nuevoValor, index) => {
                const group = formArray.at(index) as FormGroup;
                if (!cuotas[index].manual) {
                    const c = group.get('valorApto') as FormControl;
                    c.setValue(Math.round(nuevoValor), { emitEvent: true });
                    c.updateValueAndValidity({ onlySelf: true, emitEvent: false });
                }
            });
        } else {
            formArray.controls.forEach(ctrl => {
                const g = ctrl as FormGroup;
                const cValue = FinancialCalculator.toNum(g.get('valorApto')?.value);
                const rowCtrl = g.get('valorApto') as FormControl;
                if (cValue < valorMinimo && cValue !== 0) {
                    rowCtrl.setErrors({ ...rowCtrl.errors, belowMinimum: true });
                    rowCtrl.markAsTouched();
                } else {
                    if (rowCtrl.errors?.['belowMinimum']) {
                        const errs = { ...rowCtrl.errors };
                        delete errs['belowMinimum'];
                        rowCtrl.setErrors(Object.keys(errs).length ? errs : null);
                    }
                }
            });

            if (triggeringControl) {
                triggeringControl.setErrors({ ...(triggeringControl.errors || {}), invalidDistribution: true });
                triggeringControl.markAsTouched();
                const msg = result.error || 'La distribución no es válida.';
                if (this.lastAlertByControl.get(triggeringControl) !== msg) {
                    this.lastAlertByControl.set(triggeringControl, msg);
                    alert(msg);
                }
            }
        }
        this.cdr.detectChanges();
        return result;
    }

    onCuotaBlur(event: any, index: number, formArray: FormArray | undefined | null, totalFinanciar: number | undefined, valorMinimo: number) {
        if (!formArray || totalFinanciar === undefined) return;
        if (this.ignorarNextBlur) {
            this.ignorarNextBlur = false;
            return;
        }
        const relatedTarget = event.relatedTarget as HTMLElement;
        if (relatedTarget && (relatedTarget.classList.contains('edit-checkbox') || relatedTarget.classList.contains('edit-icon-label'))) return;

        const inputElement = event.target as HTMLInputElement;
        const group = formArray.at(index) as FormGroup;
        const editarControl = group.get('editarValorApto');
        const ctrl = group.get('valorApto') as FormControl;

        setTimeout(() => {
            if (editarControl?.value) {
                const rawValue = inputElement.value;
                const numericValue = FinancialCalculator.toNum(rawValue);
                ctrl.setValue(numericValue.toString(), { emitEvent: false });
                ctrl.markAsTouched();
                const result = this.ejecutarRecalculo(formArray, totalFinanciar, valorMinimo, ctrl);
                if (result && !result.success) {
                    requestAnimationFrame(() => {
                        inputElement.focus();
                        this.cdr.detectChanges();
                    });
                }
                this.cdr.detectChanges();
            }
        }, 50);
    }
}
