import { Component, OnInit, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { LoginApi } from '../../services/login-api';

declare const google: any; // Declara 'google' para evitar errores de TypeScript

@Component({
  selector: 'app-google-login',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './google-login.html',
  styleUrl: './google-login.css'
})
export class GoogleLoginComponent implements OnInit {

  mensajeError: string | null = null;

  constructor(
    private ngZone: NgZone,
    private loginApi: LoginApi,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Carga el script de Google GSI (Google Sign-In)
    this.loadGoogleScript();
    // 'bind(this)' asegura que 'this' dentro de handleCredentialResponse se refiera al componente.
    (window as any).handleCredentialResponse = this.handleCredentialResponse.bind(this);
  }

  private loadGoogleScript(): void {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }

  /**
   * Maneja la respuesta de credenciales de Google después de un inicio de sesión exitoso.
   * response.credential es un JWT firmado por Google; se lo mandamos a NUESTRO backend
   * para que lo verifique, busque/cree el Usuario, y nos devuelva NUESTRO propio token.
   */
  handleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      this.loginApi.loginGoogle(response.credential).subscribe({
        next: (user) => {
          if (user.status == 1) {
            sessionStorage.setItem('user', user.username);
            sessionStorage.setItem('userid', user.userid);
            sessionStorage.setItem('perfil', user.perfil);
            sessionStorage.setItem('token', user.token);
            sessionStorage.setItem("nombre", user.nombre);
            sessionStorage.setItem("apellido", user.apellido);
            sessionStorage.setItem("email", user.email);

            const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/';

            if (user.perfil?.toLowerCase() === 'administrador') {
              this.router.navigate(['/admin/dashboard']);
            } else {
              this.router.navigateByUrl(returnUrl);
            }
          } else {
            this.mensajeError = 'No se pudo validar la cuenta de Google.';
          }
          this.cdr.detectChanges(); // sin Zone.js, hay que avisarle a Angular manualmente
        },
        error: () => {
          this.mensajeError = 'Error al conectar con el servidor.';
          this.cdr.detectChanges();
        }
      });
    });
  }
}