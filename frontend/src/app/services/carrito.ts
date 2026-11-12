import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Producto } from '../models/producto';
import { ItemCarrito } from '../models/item-carrito';

const STORAGE_KEY = 'lumiere_carrito';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {

  private items: ItemCarrito[] = [];
  private itemsSubject = new BehaviorSubject<ItemCarrito[]>([]);

  items$ = this.itemsSubject.asObservable();

  constructor() {
    this.cargarDesdeStorage();
  }

  private cargarDesdeStorage(): void {
    try {
      const guardado = localStorage.getItem(STORAGE_KEY);
      if (guardado) {
        this.items = JSON.parse(guardado);
        this.itemsSubject.next([...this.items]);
      }
    } catch {
      this.items = [];
    }
  }

  private guardarEnStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    this.itemsSubject.next([...this.items]);
  }

  agregar(producto: Producto, cantidad: number = 1): void {
    if (!producto.stock) return;
    const existente = this.items.find(i => i.producto.id === producto.id);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      this.items.push({ producto, cantidad });
    }
    this.guardarEnStorage();
  }

  quitarUno(productoId: number): void {
    const item = this.items.find(i => i.producto.id === productoId);
    if (!item) return;
    if (item.cantidad > 1) {
      item.cantidad--;
    } else {
      this.items = this.items.filter(i => i.producto.id !== productoId);
    }
    this.guardarEnStorage();
  }

  agregarUno(productoId: number): void {
    const item = this.items.find(i => i.producto.id === productoId);
    if (item) {
      item.cantidad++;
      this.guardarEnStorage();
    }
  }

  eliminar(productoId: number): void {
    this.items = this.items.filter(i => i.producto.id !== productoId);
    this.guardarEnStorage();
  }

  vaciar(): void {
    this.items = [];
    localStorage.removeItem(STORAGE_KEY);
    this.itemsSubject.next([]);
  }

  get cantidadTotal(): number {
    return this.items.reduce((acc, i) => acc + i.cantidad, 0);
  }

  get subtotal(): number {
    return this.items.reduce((acc, i) => {
      const precio = i.producto.descuento
        ? i.producto.precio - (i.producto.precio * i.producto.descuento / 100)
        : i.producto.precio;
      return acc + precio * i.cantidad;
    }, 0);
  }
}
