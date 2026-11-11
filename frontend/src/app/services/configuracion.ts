import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Configuracion } from '../models/configuracion';

@Injectable({
  providedIn: 'root',
})
export class ConfiguracionService {
  url = "http://localhost:3000/api/configuracion";

  constructor(private http: HttpClient) { }

  getConfiguracion(): Observable<Configuracion> {
    return this.http.get<Configuracion>(this.url);
  }

  actualizarConfiguracion(configuracion: Configuracion): Observable<any> {
    return this.http.put(this.url, configuracion);
  }
}
