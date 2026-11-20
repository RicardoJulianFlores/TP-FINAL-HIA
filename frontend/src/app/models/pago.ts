export class Pago {
    mp_payment_id: string;
    estado_pago: string;
    fecha_pago: Date;
    
    constructor(mp_payment_id: string, estado_pago: string, fecha_pago: Date){
        this.mp_payment_id = mp_payment_id;
        this.estado_pago = estado_pago;
        this.fecha_pago = fecha_pago
    }
}