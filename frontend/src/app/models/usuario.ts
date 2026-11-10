export class Usuario {
    id?: number;
    username!: string;
    email!:string;
    password!: string;
    nombres!: string;
    apellido!: string;
    perfil!: string;
    constructor(username: string = "", email: string = "", password: string = "", nombres: string = "",
        apellido: string = "", perfil: string = "") {
        this.username = username;
        this.email = email;
        this.password = password;
        this.nombres = nombres;
        this.apellido = apellido;
        this.perfil = perfil;
    }
}