import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContactoService } from '../../services/contacto';
import { GoogleMap } from '../../components/google-map/google-map';
import { telefonoValidator } from '../../validators/telefono.validator';
import { nombreValidator } from '../../validators/nombre.validator';

@Component({
  selector: 'app-contacto',
  imports: [CommonModule, ReactiveFormsModule, GoogleMap],
  templateUrl: './contacto.html',
  styleUrl: './contacto.css'
})
export class Contacto {

  formulario: FormGroup;
  enviando = false;
  enviado = false;
  error = false;

  constructor(
    private fb: FormBuilder,
    private contactoService: ContactoService
  ) {
    this.formulario = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(3), nombreValidator()]],
      email: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required, telefonoValidator()]],
      asunto: ['', [Validators.required]],
      mensaje: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
    });
  }

  get nombre() { return this.formulario.get('nombre'); }
  get email() { return this.formulario.get('email'); }
  get telefono() { return this.formulario.get('telefono'); }
  get asunto() { return this.formulario.get('asunto'); }
  get mensaje() { return this.formulario.get('mensaje'); }

  onSubmit(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.enviando = true;
    this.error = false;

    this.contactoService.enviarMensaje(this.formulario.value).subscribe({
      next: () => {
        this.enviando = false;
        this.enviado = true;
        this.formulario.reset();
      },
      error: () => {
        this.enviando = false;
        this.error = true;
      }
    });
  }
}
