import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { Usuario } from '../../models/usuario';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UsuarioService } from '../../services/usuario';
import { ConfiguracionService } from '../../services/configuracion';
import { Configuracion } from '../../models/configuracion';

@Component({
  selector: 'app-modal-usuario',
  imports: [FormsModule, CommonModule],
  templateUrl: './modal-usuario.html',
  styleUrl: './modal-usuario.css',
})
export class ModalUsuario implements OnChanges, OnInit {
  @Input() usuarioEditar: Usuario | null = null;
  @Output() usuarioGuardado = new EventEmitter<void>();

  usuario: Usuario = new Usuario();
  mensaje = '';
  tipoMensaje = '';
  guardando = false;
  modoEdicion = false;
  confirmPassword: string = '';

  configuracion: Configuracion = {
    id: 1,
    longitudMinima: 8,
    requiereMayusculas: true,
    requiereNumeros: true,
    requiereEspeciales: true,
    intentosPermitidos: 5,
    tiempoBloqueoMinutos: 15,
    bloquearAutomaticamente: true,
    tiempoInactividadMinutos: 30,
    cerrarSesionAutomaticamente: true,
    permitirMultiplesSesiones: false,
    autenticacionPassword: true,
    autenticacion2FA: false,
    loginGoogle: false
  };

  constructor(private usuarioService: UsuarioService,
    private configuracionService: ConfiguracionService
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['usuarioEditar']) {
      if (this.usuarioEditar) {
        this.usuario = { ...this.usuarioEditar };
        this.modoEdicion = true;
      } else {
        this.usuario = new Usuario();
        this.modoEdicion = false;
      }
      this.mensaje = '';
      this.tipoMensaje = '';
    }
  }

  ngOnInit(): void {
    this.cargarConfiguracion();
  }

  cargarConfiguracion() {
    this.configuracionService.getConfiguracion().subscribe({
      next: (data) => {
        this.configuracion = data;
      },
      error: (err) => {
        console.error('Error al cargar configuración', err);
      }
    });
  }

  guardarUsuario(): void {
    if (this.usuario.password !== this.confirmPassword) {
      this.mensaje = "Las contraseñas no coinciden.";
      this.tipoMensaje = "danger";
      return;
    }
    if (!this.usuario.username || !this.usuario.nombres || !this.usuario.apellido || !this.usuario.perfil || !this.usuario.email) {
      this.mensaje = 'Completá todos los campos antes de guardar.';
      this.tipoMensaje = 'danger';
      return;
    }

    if (!this.modoEdicion && !this.usuario.password) {
      this.mensaje = 'La contraseña es obligatoria para crear un usuario.';
      this.tipoMensaje = 'danger';
      return;
    }

    this.guardando = true;
    this.mensaje = '';

    const solicitud = this.modoEdicion && this.usuario.id
      ? this.usuarioService.actualizarUsuario(this.usuario.id, this.usuario)
      : this.usuarioService.agregarUsuario(this.usuario);

    solicitud.subscribe({
      next: () => {
        this.mensaje = this.modoEdicion ? 'Usuario actualizado correctamente.' : 'Usuario registrado correctamente.';
        this.tipoMensaje = 'success';
        this.usuario = new Usuario();
        this.modoEdicion = false;
        this.guardando = false;
        this.usuarioGuardado.emit();
      },
      error: () => {
        this.mensaje = this.modoEdicion ? 'No se pudo actualizar el usuario.' : 'No se pudo registrar el usuario.';
        this.tipoMensaje = 'danger';
        this.guardando = false;
      }
    });
  }
}
