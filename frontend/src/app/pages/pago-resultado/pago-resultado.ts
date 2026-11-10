import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CarritoService } from '../../services/carrito';
import { PedidoService } from '../../services/pedido';

@Component({
  selector: 'app-pago-resultado',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pago-resultado.html',
  styleUrl: './pago-resultado.css'
})
export class PagoResultado implements OnInit {

  resultado: string = 'pending';
  procesando = true;

  constructor(
    private route: ActivatedRoute,
    private carritoService: CarritoService,
    private pedidoService: PedidoService,
    private cdr: ChangeDetectorRef
  ) { }

  ngOnInit(): void {
    this.resultado = this.route.snapshot.data['resultado'];

    // parámetros dinámicos de la URL que inyecta MercadoPago al volver
    this.route.queryParams.subscribe(params => {
      const paymentId = params['payment_id'] || '';
      
      // recupero el ID persistido localmente
      const pedidoId = localStorage.getItem('ultimoPedidoId');

      console.log('--- RETORNO MP ---');
      console.log('Estado Resultado:', this.resultado);
      console.log('Pedido ID Local:', pedidoId);
      console.log('ID Pago MercadoPago:', paymentId);

      if (this.resultado === 'success' && pedidoId && paymentId) {
        
        // petición HTTP mandando el body estructurado
        this.pedidoService.registrarPago({
          pedidoId: Number(pedidoId),
          mp_payment_id: paymentId,
          estado_pago: 'approved'
        }).subscribe({
          next: (resp) => {
            console.log('Backend respondió con éxito:', resp);
            
            // Limpieza
            this.carritoService.vaciar();
            localStorage.removeItem('ultimoPedidoId'); // Borramos el ID recién acá
            
            this.procesando = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            console.error('Error al intentar registrar el pago desde el componente:', err);
            this.procesando = false;
            this.cdr.detectChanges();
          }
        });
      } else {
        this.procesando = false;
        this.cdr.detectChanges();
      }
    });
  }
}