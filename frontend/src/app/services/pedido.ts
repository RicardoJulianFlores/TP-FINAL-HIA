import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Pedido } from '../models/pedido';

export interface ItemPedido {
  productoId: number;
  cantidad: number;
  precio_unitario: number;
}

export interface CrearPedidoRequest {
  usuarioId: number;
  items: ItemPedido[];
}

export interface RegistrarPagoRequest {
  pedidoId: number;
  mp_payment_id: string;
  estado_pago: 'approved' | 'rejected' | 'pending';
}

@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  private urlPedidos = 'http://localhost:3000/api/pedidos';
  private urlPagos = 'http://localhost:3000/api/pagos';

  constructor(private http: HttpClient) { }

  crearPedido(pedido: CrearPedidoRequest): Observable<any> {
    return this.http.post(this.urlPedidos, pedido);
  }

  registrarPago(pago: RegistrarPagoRequest): Observable<any> {
    return this.http.post(this.urlPagos, pago);
  }

  obtenerPedidos(): Observable<Pedido[]> {
    return this.http.get<Pedido[]>(this.urlPedidos);
  }
}