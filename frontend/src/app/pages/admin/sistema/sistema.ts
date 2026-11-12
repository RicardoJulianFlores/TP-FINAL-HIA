import { Component, OnInit } from '@angular/core';
import { EstadisticasDashboard, ServicioDashboard } from '../../../services/dashboard';
import { CommonModule } from '@angular/common';
import { LoginApi } from '../../../services/login-api';

@Component({
  selector: 'app-sistema',
  imports: [CommonModule],
  templateUrl: './sistema.html',
  styleUrl: './sistema.css',
})
export class Sistema implements OnInit {
  datosSistema: EstadisticasDashboard = {
    usuarios: 0,
    productos: 0,
    pedidos: 0,
    ventasMes: 0,
    mensajes: 0,
    clientes: 0,
    estadoSistema: {
      api: false,
      baseDatos: false,
      mercadoPago: false,
      servidor: false
    },
    informacionSistema: {
      version: 'Cargando...',
      framework: 'Angular',
      nodeVersion: 'Cargando...',
      baseDatos: 'PostgreSQL',
      ultimaActualizacion: 'Cargando...',
      emailJs: false
    }
  };

  cargando = true;
  error = false;

  constructor(private servicioDashboard: ServicioDashboard,
    public loginApi: LoginApi
  ) { }

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.cargando = true;
    this.error = false;

    this.servicioDashboard.obtenerEstadisticas().subscribe({
      next: (datos) => {
        this.datosSistema = {
          ...datos,
          estadoSistema:
            datos.estadoSistema ?? this.datosSistema.estadoSistema,
          informacionSistema:
            datos.informacionSistema ?? this.datosSistema.informacionSistema,
        };
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error al cargar datos del sistema:', err);
        this.error = true;
        this.cargando = false;
      }
    });
  }

  getBadgeClass(estado: boolean | undefined): string {
    return estado ? 'bg-success' : 'bg-danger';
  }

  getEstadoTexto(estado: boolean | undefined): string {
    return estado ? 'En línea' : 'Caído';
  }
}
