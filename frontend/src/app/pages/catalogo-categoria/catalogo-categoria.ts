import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Producto } from '../../models/producto';
import { ProductoService } from '../../services/producto';
import { CarritoService } from '../../services/carrito';
import { PrecioDescuentoPipe } from '../../pipes/precio-descuento-pipe';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-catalogo-categoria',
  imports: [CommonModule, RouterLink, PrecioDescuentoPipe],
  templateUrl: './catalogo-categoria.html',
  styleUrl: './catalogo-categoria.css'
})
export class CatalogoCategoria implements OnInit {

  productos: Producto[] = [];
  categoria = '';
  cargando = true;
  agregadoId: number | null = null;

  nombresCategoria: { [key: string]: string } = {
    anillos: 'Anillos',
    collares: 'Collares',
    aretes: 'Aretes',
    pulseras: 'Pulseras'
  };

  constructor(
    private route: ActivatedRoute,
    private productoService: ProductoService,
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.categoria = params.get('categoria') || '';
      this.cargarProductos();
    });
  }

  get nombreCategoria(): string {
    return this.nombresCategoria[this.categoria] || this.categoria;
  }

  private cargarProductos(): void {
    this.cargando = true;
    this.productoService.getProductosPorCategoria(this.categoria).subscribe(productos => {
      this.productos = productos.filter(producto => producto.stock > 0);
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