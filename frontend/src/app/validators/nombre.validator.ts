import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export function nombreValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const valor = control.value;
    if (!valor) {
      return null;
    }
    const soloLetras = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(valor);
    return soloLetras ? null : { nombreFormato: true };
  };
}
