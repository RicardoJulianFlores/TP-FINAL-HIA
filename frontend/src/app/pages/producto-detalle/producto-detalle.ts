import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { take } from 'rxjs/operators';
import { Producto } from '../../models/producto';
import { ProductoService } from '../../services/producto';
import { CarritoService } from '../../services/carrito';
import { PrecioDescuentoPipe } from '../../pipes/precio-descuento-pipe';

@Component({
  selector: 'app-producto-detalle',
  imports: [CommonModule, RouterLink, PrecioDescuentoPipe],
  templateUrl: './producto-detalle.html',
  styleUrl: './producto-detalle.css'
})
export class ProductoDetalle implements OnInit {

  producto: Producto | undefined;
  cargando = true;
  noEncontrado = false;
  cantidad = 1;
  agregado = false;
  faltaStock = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productoService: ProductoService,
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = Number(params.get('id'));
      this.cargando = true;
      this.productoService.getProductoPorId(id).subscribe(producto => {
        this.producto = producto;
        this.noEncontrado = !producto;
        this.cargando = false;
        this.cdr.detectChanges();
      });
    });
  }

  aumentarCantidad(): void {
    this.cantidad++;
  }

  disminuirCantidad(): void {
    if (this.cantidad > 1) this.cantidad--;
  }

  agregarAlCarrito(): void {
    const producto = this.producto;
    if (!producto) return;

    this.carritoService.items$.pipe(take(1)).subscribe(items => {
      const existente = items.find(i => i.producto.id === producto.id);
      const cantidadEnCarrito = existente ? existente.cantidad : 0;

      if (producto.stock < cantidadEnCarrito + this.cantidad) {
        this.faltaStock = true;
        setTimeout(() => {
        this.faltaStock = false;
        this.cdr.detectChanges();
        }, 2000);
        return;
      }

      this.carritoService.agregar(producto, this.cantidad);
      this.agregado = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.agregado = false;
        this.cdr.detectChanges();
      }, 2000);
    });
  }

  irAlCarrito(): void {
    this.router.navigate(['/carrito']);
  }
}