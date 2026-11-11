import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ItemCarrito } from '../models/item-carrito';
import { Pago } from '../models/pago';

export interface CompradorMp {
  email: string,
  name: string,
  surname: string,
  phone: {
    area_code: string,
    number: string,
  },
  identification: {
    type: string,
    number: string
  },
  address: {
    street_name: string,
    street_number: number,
    zip_code: string
  }
}

export interface ProductoMp {
  title: string;
  description: string;
  picture_url: string;
  category_id: string;
  quantity: number;
  unit_price: number;
}

export interface PreferenciaPago {
  items: ItemCarrito[];
  comprador: CompradorMp;
}

export interface PreferenciaPagoRequest {
  items: ProductoMp[];
  comprador: CompradorMp;
}

export interface RespuestaPago {
  preferenceId: string;
  init_point: string;
  sandboxInitPoint: string;
}

@Injectable({
  providedIn: 'root'
})
export class PagoService {

  pagos: Pago[] = [];

  private apiUrl = 'http://localhost:3000/api/mp/payment';
  private apiPagosUrl = 'http://localhost:3000/api/pagos';

  constructor(private http: HttpClient) { }

  crearPreferencia(carrito: PreferenciaPago): Observable<RespuestaPago> {
    const payload: PreferenciaPagoRequest = {
      items: this.mapItemsToProductosMp(carrito.items),
      comprador: carrito.comprador
    };

    return this.http.post<RespuestaPago>(this.apiUrl, payload).pipe(
      catchError(error => {
        console.error('Error al crear la preferencia de pago', error);
        return throwError(() => error);
      })
    );
  }

  private mapItemsToProductosMp(items: ItemCarrito[]): ProductoMp[] {
    return items.map(item => ({
      title: item.producto.nombre,
      description: item.producto.descripcion,
      picture_url: item.producto.imagen,
      category_id: item.producto.categoria,
      quantity: item.cantidad,
      unit_price: item.producto.precio
    }));
  }

  getPagos(): Observable<Pago[]> {
    return this.http.get<Pago[]>(this.apiPagosUrl);
  }

}