import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Usuario } from '../models/usuario';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {

  private urlBase = 'http://localhost:3000/api/usuario/';

  constructor(private http: HttpClient) { }


  obtenerUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.urlBase);
  }

  agregarUsuario(usuario: Usuario): Observable<any> {
    return this.http.post<any>(this.urlBase, usuario);
  }

  actualizarUsuario(id: number, usuario: Usuario): Observable<any> {
    return this.http.put<any>(`${this.urlBase}${id}`, usuario);
  }

  eliminarUsuario(id: number): Observable<any> {
    return this.http.delete<any>(`${this.urlBase}${id}`);
  }

  buscarUsuarios(texto: string): Observable<any> {
    return this.http.get<any>(`${this.urlBase}buscar/${texto}`);
  }

}