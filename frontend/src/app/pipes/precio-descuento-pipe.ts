import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'precioDescuento'
})
export class PrecioDescuentoPipe implements PipeTransform {

  transform(precio: number, descuento: number = 0): string {
    if (!descuento) {
      return this.formatear(precio);
    }
    const precioFinal = precio - (precio * descuento / 100);
    return this.formatear(precioFinal);
  }

  private formatear(valor: number): string {
    return valor.toLocaleString('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0
    });
  }
}
