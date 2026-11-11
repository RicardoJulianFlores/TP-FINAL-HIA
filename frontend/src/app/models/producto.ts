export interface Producto {
  id: number;
  nombre: string;
  categoria: 'anillos' | 'collares' | 'aretes' | 'pulseras' | '';
  precio: number;
  descuento?: number;
  imagen: string;
  descripcion: string;
  material: string;
  destacado?: boolean;
  stock: number;
}
