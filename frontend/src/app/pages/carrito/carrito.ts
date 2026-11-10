import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ItemCarrito } from '../../models/item-carrito';
import { CarritoService } from '../../services/carrito';
import { PrecioDescuentoPipe } from '../../pipes/precio-descuento-pipe';

@Component({
  selector: 'app-carrito',
  imports: [CommonModule, RouterLink, PrecioDescuentoPipe],
  templateUrl: './carrito.html',
  styleUrl: './carrito.css'
})
export class Carrito implements OnInit {

  items: ItemCarrito[] = [];

  constructor(
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.carritoService.items$.subscribe(items => {
      this.items = items;
      this.cdr.detectChanges();
    });
  }

  get subtotal(): number {
    return this.carritoService.subtotal;
  }

  get envio(): number {
    return this.subtotal >= 40000 ? 0 : 4500;
  }

  get total(): number {
    return this.subtotal + this.envio;
  }

  aumentar(productoId: number): void {
    this.carritoService.agregarUno(productoId);
  }

  disminuir(productoId: number): void {
    this.carritoService.quitarUno(productoId);
  }

  eliminar(productoId: number): void {
    this.carritoService.eliminar(productoId);
  }

  vaciar(): void {
    if (confirm('¿Querés vaciar el carrito?')) {
      this.carritoService.vaciar();
    }
  }

  precioFinalProducto(item: ItemCarrito): number {
    const p = item.producto;
    return p.descuento
      ? p.precio - (p.precio * p.descuento / 100)
      : p.precio;
  }
}
