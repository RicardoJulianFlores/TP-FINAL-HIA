import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GoogleMap } from '../../components/google-map/google-map';

interface Valor {
  icono: string;
  titulo: string;
  texto: string;
}

@Component({
  selector: 'app-nosotros',
  imports: [CommonModule, GoogleMap],
  templateUrl: './nosotros.html',
  styleUrl: './nosotros.css'
})
export class Nosotros {

  valores: Valor[] = [
    {
      icono: 'bi-gem',
      titulo: 'Calidad garantizada',
      texto: 'Trabajamos solo con plata 925, oro laminado y acero quirúrgico hipoalergénico.'
    },
    {
      icono: 'bi-hand-thumbs-up',
      titulo: 'Diseño propio',
      texto: 'Cada colección es pensada y curada por nuestro equipo de diseño.'
    },
    {
      icono: 'bi-truck',
      titulo: 'Envíos a todo el país',
      texto: 'Despachamos a todas las provincias con seguimiento en tiempo real.'
    }
  ];
}
