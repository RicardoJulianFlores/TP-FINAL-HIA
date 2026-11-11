import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Producto } from '../models/producto';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {

  private apiUrl = 'http://localhost:3000/api/productos';

  private productosMock: Producto[] = [
    {
      id: 1,
      nombre: 'Anillo Solitario Plata 925',
      categoria: 'anillos',
      precio: 45000,
      descuento: 15,
      imagen: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?w=600',
      descripcion: 'Anillo solitario en plata 925 con circonia central, acabado pulido a espejo.',
      material: 'Plata 925',
      destacado: true,
      stock: 1
    },
    {
      id: 2,
      nombre: 'Anillo Trinity Oro Laminado',
      categoria: 'anillos',
      precio: 38000,
      descuento: 0,
      imagen: 'https://images.unsplash.com/photo-1603561591411-07134e71a2a9?w=600',
      descripcion: 'Anillo de tres aros entrelazados, oro laminado 18k, ideal uso diario.',
      material: 'Oro laminado 18k',
      destacado: false,
      stock: 1
    },
    {
      id: 3,
      nombre: 'Anillo Ajustable Perla',
      categoria: 'anillos',
      precio: 29500,
      descuento: 10,
      imagen: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600',
      descripcion: 'Anillo ajustable con perla cultivada, base en plata.',
      material: 'Plata y perla cultivada',
      destacado: false,
      stock: 1
    },
    {
      id: 4,
      nombre: 'Collar Gargantilla Minimalista',
      categoria: 'collares',
      precio: 32000,
      descuento: 20,
      imagen: 'https://images.unsplash.com/photo-1599643477877-530eb83abc8e?w=600',
      descripcion: 'Gargantilla fina de acero quirúrgico dorado, no se oxida ni se mancha.',
      material: 'Acero quirúrgico dorado',
      destacado: true,
      stock: 1
    },
    {
      id: 5,
      nombre: 'Collar Cadena Cubana',
      categoria: 'collares',
      precio: 56000,
      descuento: 0,
      imagen: 'https://napoleonejoyas.co/cdn/shop/files/5156788901426343332_99527c7a-0ce1-4b03-97c7-ef034d92f140.jpg?v=1727130747',
      descripcion: 'Cadena cubana clásica, eslabones macizos en oro laminado.',
      material: 'Oro laminado 18k',
      destacado: false,
      stock: 1
    },
    {
      id: 6,
      nombre: 'Collar Colgante Corazón',
      categoria: 'collares',
      precio: 27500,
      descuento: 12,
      imagen: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600',
      descripcion: 'Colgante corazón en plata con baño de rodio, cadena incluida.',
      material: 'Plata 925 con baño de rodio',
      destacado: true,
      stock: 0
    },
    {
      id: 7,
      nombre: 'Aretes Argolla Clásica',
      categoria: 'aretes',
      precio: 21000,
      descuento: 0,
      imagen: 'https://images.unsplash.com/photo-1635767798638-3e25273a8236?w=600',
      descripcion: 'Argollas medianas en acero dorado, livianas y antialérgicas.',
      material: 'Acero quirúrgico dorado',
      destacado: false,
      stock: 1
    },
    {
      id: 8,
      nombre: 'Aretes Perla Boton',
      categoria: 'aretes',
      precio: 18500,
      descuento: 10,
      imagen: 'https://images.unsplash.com/photo-1630019852942-f89202989a59?w=600',
      descripcion: 'Aretes tipo botón con perla cultivada, base de plata.',
      material: 'Plata y perla cultivada',
      destacado: false,
      stock: 1
    },
    {
      id: 9,
      nombre: 'Aretes Colgantes Geométricos',
      categoria: 'aretes',
      precio: 24000,
      descuento: 0,
      imagen: 'https://m.media-amazon.com/images/I/71FJPvC36VL._AC_UY1000_.jpg',
      descripcion: 'Diseño geométrico colgante, acabado dorado mate.',
      material: 'Acero dorado mate',
      destacado: true,
      stock: 1
    },
    {
      id: 10,
      nombre: 'Pulsera Tenis Circonias',
      categoria: 'pulseras',
      precio: 41000,
      descuento: 18,
      imagen: 'https://newswarovskiargentina.vtexassets.com/unsafe/1440x0/center/middle/https%3A%2F%2Fnewswarovskiargentina.vtexassets.com%2Farquivos%2Fids%2F658015%2F5742026-1.jpg%3Fv%3D639040200568400000',
      descripcion: 'Pulsera tipo tenis con circonias engastadas en toda su extensión.',
      material: 'Plata 925',
      destacado: true,
      stock: 1
    },
    {
      id: 11,
      nombre: 'Pulsera Cadena Forzada',
      categoria: 'pulseras',
      precio: 26500,
      descuento: 0,
      imagen: 'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600',
      descripcion: 'Cadena forzada clásica, cierre de mosquetón reforzado.',
      material: 'Oro laminado 18k',
      destacado: false,
      stock: 1
    },
    {
      id: 0,
      nombre: 'Pulsera Charms Personalizable',
      categoria: 'pulseras',
      precio: 33000,
      descuento: 8,
      imagen: 'https://images.unsplash.com/photo-1611955167811-4711904bb9f8?w=600',
      descripcion: 'Base para charms intercambiables, incluye dos charms de regalo.',
      material: 'Plata 925',
      destacado: false,
      stock: 1
    }
  ];

  constructor(private http: HttpClient) { }

  getProductos(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl);
  }

  getProductosPorCategoria(categoria: string): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${this.apiUrl}/categoria/${categoria}`);
  }

  getProductoPorId(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${this.apiUrl}/${id}`);
  }

  getDestacados(): Observable<Producto[]> {
    return this.http.get<Producto[]>(`${this.apiUrl}/destacados`);
  }

  addProducto(producto: Producto): Observable<any> {
    const httpOption = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
    const { id, ...productoSinId } = producto;
    let body = JSON.stringify(productoSinId);
    return this.http.post<Producto>(this.apiUrl, body, httpOption);
  }

  getProductosMock(): Producto[] {
    return this.productosMock;
  } 

  editProducto(producto: Producto): Observable<any> {
    const httpOption = {
      headers: new HttpHeaders({
        'Content-Type': 'application/json'
      })
    }
    let body = JSON.stringify(producto);
    return this.http.put<Producto[]>(`${this.apiUrl}/${producto.id}`, body, httpOption);
  }

  deleteProducto(producto: Producto): Observable<any> {
    return this.http.delete<Producto[]>(`${this.apiUrl}/${producto.id}`);
  }
}
