import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class EstadisticaService {
  private http = inject(HttpClient);

  private api = 'http://localhost:3000/api/estadisticas';

  getVentasPorCategoria(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/grafico-categorias`);
  }

  getIngresosPorFecha() {
    return this.http.get<any[]>(`${this.api}/grafico-ingresos`);
  }

  getTotalVentas() {
    return this.http.get<any>(`${this.api}/total-ventas`);
  }

  getPedidosPendientes() {
    return this.http.get<any>(`${this.api}/pedidos-pendientes`);
  }

  getProductosSinStock() {
    return this.http.get<any>(`${this.api}/productos-sin-stock`);
  }

  getProductosMasVendidos() {
    return this.http.get<any[]>(`${this.api}/productos-mas-vendidos`);
  }

}
