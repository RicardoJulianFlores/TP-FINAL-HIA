import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface Categoria {
  nombre: string;
  slug: string;
  imagen: string;
  icono: string;
}

@Component({
  selector: 'app-catalogo',
  imports: [CommonModule, RouterLink],
  templateUrl: './catalogo.html',
  styleUrl: './catalogo.css'
})
export class Catalogo {

  categorias: Categoria[] = [
    {
      nombre: 'Anillos',
      slug: 'anillos',
      imagen: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
      icono: 'bi-circle'
    },
    {
      nombre: 'Collares',
      slug: 'collares',
      imagen: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600',
      icono: 'bi-droplet'
    },
    {
      nombre: 'Aretes',
      slug: 'aretes',
      imagen: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=600',
      icono: 'bi-star'
    },
    {
      nombre: 'Pulseras',
      slug: 'pulseras',
      imagen: 'https://images.unsplash.com/photo-1689367436629-1d288f1e23b6?w=600"',
      icono: 'bi-arrow-repeat'
    }
  ];
}
