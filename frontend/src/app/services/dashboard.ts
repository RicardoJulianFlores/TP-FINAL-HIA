import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface EstadoSistema {
  api: boolean;
  baseDatos: boolean;
  mercadoPago: boolean;
  servidor: boolean;
}

export interface InformacionSistema {
  version: string;
  framework: string;
  nodeVersion: string;
  baseDatos: string;
  ultimaActualizacion: string;
  emailJs: boolean;
}

export interface EstadisticasDashboard {
  usuarios: number;
  productos: number;
  pedidos: number;
  ventasMes: number;
  mensajes: number;
  clientes: number;
  estadoSistema: EstadoSistema;
  informacionSistema?: InformacionSistema;
}

@Injectable({
  providedIn: 'root'
})
export class ServicioDashboard {
  private urlApi = 'http://localhost:3000/api/dashboard/stats';

  obtenerEstadisticas(): Observable<EstadisticasDashboard> {
    return new Observable((observador) => {
      fetch(this.urlApi)
        .then(async (respuesta) => {
          if (!respuesta.ok) {
            throw new Error('No se pudo cargar el dashboard');
          }

          const datos = await respuesta.json();
          observador.next(datos);
          observador.complete();
        })
        .catch((error) => {
          observador.error(error);
        });
    });
  }
}
