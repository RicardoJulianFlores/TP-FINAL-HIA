import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Usuario } from '../models/usuario';
@Injectable({
  providedIn: 'root',
})
export class LoginApi {
  hostBase: string;
  constructor(private _http: HttpClient) {
    this.hostBase = "http://localhost:3000/api/usuario/";
  }
  public login(username: string, password: string): Observable<any> {
    const httpOption = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
    let body = JSON.stringify({ username: username, password: password });
    return this._http.post(this.hostBase + 'login', body, httpOption);
  }
  public loginGoogle(credential: string): Observable<any> {
    const httpOption = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
    let body = JSON.stringify({ credential: credential });
    return this._http.post(this.hostBase + 'google-login', body, httpOption);
  }
  
  public logout() {
    //borro el vble almacenado mediante el storage
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("perfil");
    sessionStorage.removeItem("userid");
    sessionStorage.removeItem("token");
  }
  public userLoggedIn() {
    var resultado = false;
    var usuario = sessionStorage.getItem("user");
    if (usuario != null) {
      resultado = true;
    }
    return resultado;
  }
  public userLogged() {
    var usuario = sessionStorage.getItem("user");
    return usuario;
  }
  public idLogged() {
    var id = sessionStorage.getItem("userid");
    return id;
  }

  public getPerfil() {
    var perfil = sessionStorage.getItem("perfil");
    return perfil;
  }

  getToken():string{
    return sessionStorage.getItem("token") as string;
  }

  public register(userform: Usuario): Observable<any>{
    const httpOption = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
    let body = JSON.stringify(userform);
    return this._http.post(this.hostBase, body, httpOption);
  }

  public acceso(userId:number, msg:string):Observable<any>{
    const httpOption = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
    let body = JSON.stringify({
      accion_realizada:msg,
      ip_origen:"nose"
    });
    return this._http.post(this.hostBase + userId + '/acceso', body, httpOption);
  }
}