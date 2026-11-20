import { Injectable } from '@angular/core';
import { from, Observable } from 'rxjs';
import emailjs from '@emailjs/browser';
import { environment } from '../../environments/environment';
import { MensajeContacto } from '../models/mensaje-contacto';

@Injectable({
  providedIn: 'root'
})
export class ContactoService {

  constructor() {
    emailjs.init(environment.emailjsPublicKey);
  }

  enviarMensaje(mensaje: MensajeContacto): Observable<any> {
    const templateParams = {
      from_name: mensaje.nombre,
      from_email: mensaje.email,
      phone: mensaje.telefono,
      subject: mensaje.asunto,
      message: mensaje.mensaje,
      to_name: 'Joyería Lumière'
    };

    return from(
      emailjs.send(
        environment.emailjsServiceId,
        environment.emailjsTemplateId,
        templateParams
      )
    );
  }
}