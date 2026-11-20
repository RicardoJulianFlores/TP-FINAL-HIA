import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { PrecioDescuentoPipe } from '../../pipes/precio-descuento-pipe';
import { Producto } from '../../models/producto';
import { CommonModule } from '@angular/common';
import { ProductoService } from '../../services/producto';

@Component({
  selector: 'app-stock',
  imports: [CommonModule,RouterLink,PrecioDescuentoPipe,FormsModule],
  templateUrl: './stock.html',
  styleUrl: './stock.css',
})
export class Stock {
  productos: Producto[] = [];
  cargando = true;

  mostrarModal = false;
  guardando = false;
  productoSeleccionado: Producto | null = null;
  modoEdicion = false; // true = editar, false = crear nuevo

  mostrarModalBorrar = false;
  borrando = false;
  productoABorrar: Producto | null = null;

  erroMsg = '';

  // Paginación
  pagina = 1;
  limite = 20;
  total = 0;
  busqueda = '';

  constructor(
    private productoService: ProductoService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarProductos();
  }

  get totalPaginas(): number {
    return Math.max(Math.ceil(this.total / this.limite), 1);
  }

  cargarProductos(){
    this.cargando = true;
    this.productoService.getProductos(this.pagina, this.limite, this.busqueda).subscribe({
      next: (resp) => {
        this.productos = resp.data;
        this.total = resp.total;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.cargando = false;
        // Solo redirigimos al login si el problema es de autenticación/permisos
        if (err.status === 401 || err.status === 403) {
          this.erroMsg = 'Debes ingresar con una cuenta Empleado';
          this.cdr.detectChanges();
          setTimeout(() => this.router.navigateByUrl('/login'), 1500);
        } else {
          this.erroMsg = 'No se pudieron cargar los productos. Intentá de nuevo.';
          this.cdr.detectChanges();
        }
      }
    });
  }

  irAPagina(p: number){
    if (p < 1 || p > this.totalPaginas || p === this.pagina) return;
    this.pagina = p;
    this.cargarProductos();
  }

  buscar(){
    this.pagina = 1;
    this.cargarProductos();
  }

  editar(producto: Producto){
    this.modoEdicion = true;
    this.productoSeleccionado = { ...producto };
    this.mostrarModal = true;
  }

  agregar(){
    this.modoEdicion = false;
    this.productoSeleccionado = {
      id:0,
      nombre: '',
      categoria: '',
      precio: 0,
      descuento: 0,
      imagen: '',
      descripcion: '',
      material: '',
      destacado: false,
      stock: 1
    };
    this.mostrarModal = true;
  }

  cerrarModal(){
    this.mostrarModal = false;
    this.productoSeleccionado = null;
    this.modoEdicion = false;
  }

  guardarEdicionoAgregar(){
    if (!this.productoSeleccionado) return;
    this.guardando = true;

    const peticion = this.modoEdicion
      ? this.productoService.editProducto(this.productoSeleccionado)
      : this.productoService.addProducto(this.productoSeleccionado);

    peticion.subscribe({
      next: () => {
        this.guardando = false;
        this.cerrarModal();
        this.cargarProductos();
      },
      error: (err) => {
        console.error(err);
        this.guardando = false;
      }
    });
  }

  borrar(producto: Producto){
    this.productoABorrar = producto;
    this.mostrarModalBorrar = true;
  }

  cerrarModalBorrar(){
    this.mostrarModalBorrar = false;
    this.productoABorrar = null;
  }

  confirmarBorrado(){
    if (!this.productoABorrar) return;

    this.borrando = true;
    this.productoService.deleteProducto(this.productoABorrar).subscribe({
      next: () => {
        this.borrando = false;
        this.cerrarModalBorrar();
        this.cargarProductos();
      },
      error: (err) => {
        console.error(err);
        this.borrando = false;
      }
    });
  }

  montarMock(){
    const productosMock = this.productoService.getProductosMock();
    if(this.total != 0){
      alert("El stock debe estar vacio para montar el mock");
      return
    }
    this.cargando = true;
    forkJoin(
      productosMock.map(producto => this.productoService.addProducto(producto))
    ).subscribe({
      next: (msg) => {
        console.log(msg);
        this.cargando = false;
        this.cargarProductos();
      },
      error: (err) => {
        console.error(err);
        this.cargando = false;
        this.cargarProductos();
      }
    });
  }
}