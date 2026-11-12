import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Usuario } from '../../models/usuario';
import { LoginApi } from '../../services/login-api';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Configuracion } from '../../models/configuracion';
import { ConfiguracionService } from '../../services/configuracion';

@Component({
  selector: 'app-register-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register-form.html',
  styleUrl: './register-form.css',
})
export class RegisterForm implements OnInit {
  userform: Usuario = new Usuario(); // usuario mapeado al formulario
  confirmPassword: string = '';
  msgregister!: string; // mensaje de error del registro
  successMsg!: string; // mensaje de éxito del registro
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
  constructor(
    private router: Router,
    private loginApi: LoginApi,
    private configuracionService: ConfiguracionService,
    private cdr: ChangeDetectorRef) {
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
        console.error('Error al cargar la configuración', err);
      }
    });
  }

  register() {
    // validación básica de coincidencia de contraseñas
    if (this.userform.password !== this.confirmPassword) {
      this.msgregister = 'Las contraseñas no coinciden.';
      return;
    }
    this.userform.perfil = "Cliente";

    this.loginApi.register(this.userform)
      .subscribe(
        (result) => {
          var user = result;
          if (user.status == 1) {
            this.successMsg = 'Cuenta creada correctamente. Ya puedes iniciar sesión.';
            this.msgregister = '';
            this.cdr.detectChanges();
            // redirigimos al login luego de un breve delay
            setTimeout(() => this.router.navigateByUrl('/login'), 1500);
          } else {
            // el usuario ya existe u otro error de negocio
            this.msgregister = user.msg || 'No se pudo completar el registro.';
            this.cdr.detectChanges();
          }
        },
        error => {
          alert('Error de conexion');
          console.log('error en conexion');
        });
  }
}