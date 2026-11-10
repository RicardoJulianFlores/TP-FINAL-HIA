export interface Detalle {
    id: number;
    pedidoId: number;
    productoId: number;
    cantidad: number;
    precio_unitario: number;
}

export interface Usuario {
    id: number;
    nombres: string;
    apellido: string;
}

export interface Pedido {
    id: number;
    Usuario: Usuario;
    fecha: string;
    total: number;
    estado_envio: string;
    id_mercado_pago: string | null;
    updatedAt: string;
    detalles: Detalle[];
}