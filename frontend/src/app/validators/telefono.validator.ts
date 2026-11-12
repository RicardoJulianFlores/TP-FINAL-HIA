import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function telefonoValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!valor) {
      return null;
    }
    const soloNumeros = /^[0-9]+$/.test(valor);
    const longitudValida = valor.length >= 8 && valor.length <= 15;

    if (!soloNumeros) {
      return { telefonoFormato: true };
    }
    if (!longitudValida) {
      return { telefonoLongitud: true };
    }
    return null;
  };
}
