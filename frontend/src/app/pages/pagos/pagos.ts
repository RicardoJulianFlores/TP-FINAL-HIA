import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { Pago } from '../../models/pago';
import { PagoService } from '../../services/pago';

@Component({
  selector: 'app-pagos',
  imports: [CommonModule],
  templateUrl: './pagos.html',
  styleUrl: './pagos.css',
})
export class Pagos implements OnInit{

  pagos: Pago[] = [];
  private cdr = inject(ChangeDetectorRef);
  constructor(private pagoService: PagoService) {}

  ngOnInit(): void {
    this.cargarPagos();
  }

  cargarPagos(): void {
    this.pagoService.getPagos().subscribe({
      next: (data) => {
        console.log("¿Qué me está devolviendo el backend?", data);
        this.pagos = data;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error(err);
      }
    });
  }
}
