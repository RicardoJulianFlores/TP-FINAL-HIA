import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { take } from 'rxjs/operators';
import { Producto } from '../../models/producto';
import { ProductoService } from '../../services/producto';
import { CarritoService } from '../../services/carrito';
import { PrecioDescuentoPipe } from '../../pipes/precio-descuento-pipe';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, PrecioDescuentoPipe],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class Home implements OnInit {

  destacados: Producto[] = [];
  cargando = true;
  agregadoId: number | null = null;
  faltaStock = false;

  constructor(
    private productoService: ProductoService,
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.productoService.getDestacados().subscribe(productos => {
      this.destacados = productos.filter(producto => producto.stock > 0);
      this.cargando = false;
      this.cdr.detectChanges();
    });
  }

  agregarAlCarrito(producto: Producto): void {
    if (producto.stock === 0) return;

    this.carritoService.items$.pipe(take(1)).subscribe(items => {
      const existente = items.find(i => i.producto.id === producto.id);
      const cantidadEnCarrito = existente ? existente.cantidad : 0;

      if (producto.stock <= cantidadEnCarrito) {
        alert("No puede agregar mas productos por falta de stock");
        return;
      }

      this.carritoService.agregar(producto, 1);
      this.agregadoId = producto.id;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.agregadoId = null;
        this.cdr.detectChanges();
      }, 1500);
      this.cdr.detectChanges();
    });
  }
}