export class Configuracion {

    id!: number;

    longitudMinima!: number;
    requiereMayusculas!: boolean;
    requiereNumeros!: boolean;
    requiereEspeciales!: boolean;

    intentosPermitidos!: number;
    tiempoBloqueoMinutos!: number;
    bloquearAutomaticamente!: boolean;

    tiempoInactividadMinutos!: number;
    cerrarSesionAutomaticamente!: boolean;

    permitirMultiplesSesiones!: boolean;

    autenticacionPassword!: boolean;
    autenticacion2FA!: boolean;
    loginGoogle!: boolean;

}