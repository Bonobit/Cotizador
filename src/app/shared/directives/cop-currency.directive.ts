import { Directive, HostListener, ElementRef, OnInit, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CurrencyPipe } from '@angular/common';

@Directive({
    selector: '[appCopCurrency]',
    standalone: true,
    providers: [
        {
            provide: NG_VALUE_ACCESSOR,
            useExisting: forwardRef(() => CopCurrencyDirective),
            multi: true
        },
        CurrencyPipe
    ]
})
export class CopCurrencyDirective implements ControlValueAccessor, OnInit {

    private _value: any = '';

    constructor(private el: ElementRef, private currencyPipe: CurrencyPipe) { }

    ngOnInit() {
        this.format(this._value);
    }

    @HostListener('input', ['$event'])
    onInput(event: Event) {
        const input = event.target as HTMLInputElement;
        const value = input.value;

        // 1. Eliminar caracteres no numéricos
        const numericValue = value.replace(/[^0-9]/g, '');

        // 2. Emitir valor limpio al modelo (si es string o number, depende lo que quieras)
        // Aquí emitimos numero o null si esta vacio
        this.onChange(numericValue ? Number(numericValue) : null);

        // 3. Formatear y mostrar en el input
        this.format(numericValue);
    }

    @HostListener('blur')
    onBlur() {
        this.format(this.el.nativeElement.value);
        this.onTouched();
    }

    private format(value: any) {
        if (value === null || value === undefined || value === '') {
            this.el.nativeElement.value = '';
            return;
        }

        // Limpiar para asegurar que es numero
        const clean = String(value).replace(/[^0-9]/g, '');
        if (!clean) {
            this.el.nativeElement.value = '';
            return;
        }

        // Formatear como moneda COP sin decimales (generalmente)
        // $ 1.000.000
        // Usamos CurrencyPipe de Angular pero ajustado
        // 'COP' suele poner simbolo COP or $. Use 'symbol' para $
        // digitsInfo: '1.0-0' para sin decimales

        // Problema: CurrencyPipe de angular usa locale. Si no está configurado 'es-CO', puede salir raro.
        // Haremos un formateo manual simple con Intl si CurrencyPipe no da lo esperado por defecto.

        // Opción Manual Robusta:
        const formatted = new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(Number(clean));

        this.el.nativeElement.value = formatted;
    }

    // ControlValueAccessor implementation
    onChange = (_: any) => { };
    onTouched = () => { };

    writeValue(value: any): void {
        this._value = value;
        this.format(value);
    }

    registerOnChange(fn: any): void {
        this.onChange = fn;
    }

    registerOnTouched(fn: any): void {
        this.onTouched = fn;
    }

    setDisabledState?(isDisabled: boolean): void {
        this.el.nativeElement.disabled = isDisabled;
    }
}
