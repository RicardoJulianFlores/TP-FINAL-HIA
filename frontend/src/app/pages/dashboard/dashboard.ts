import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { EstadisticaService } from '../../services/estadistica';

// Registramos todos los componentes necesarios de Chart.js (líneas, barras, tortas, etc.)
Chart.register(...registerables);

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardEmpleado implements OnInit, AfterViewInit {

  // Capturamos el elemento <canvas> del HTML de forma segura
  @ViewChild('chartCanvas')
  chartCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild('lineChartCanvas')
  lineChartCanvas!: ElementRef<HTMLCanvasElement>;

  @ViewChild('barChartCanvas')
  barChartCanvas!: ElementRef<HTMLCanvasElement>;

  doughnutChart: any;
  lineChart: any;
  barChart: any;

  totalVentas = 0;

  pedidosPendientes = 0;

  productosSinStock = 0;

  constructor(
    private estadisticaService: EstadisticaService
  ) { }

  ngOnInit(): void {
    this.cargarTarjetas();
  }

  cargarTarjetas() {
    this.estadisticaService.getTotalVentas().subscribe({
      next: (resp) => {
        this.totalVentas = Number(resp.total);
      }
    });
    this.estadisticaService.getPedidosPendientes().subscribe({
      next: (resp) => {
        this.pedidosPendientes = resp.cantidad;
      }
    });
    this.estadisticaService.getProductosSinStock().subscribe({
      next: (resp) => {
        this.productosSinStock = resp.cantidad;
      }
    });
  }

  ngAfterViewInit(): void {
    this.cargarGraficoCategorias();
    this.cargarGraficoIngresos();
    this.cargarGraficoProductosMasVendidos();
  }

  cargarGraficoCategorias() {
    this.estadisticaService.getVentasPorCategoria().subscribe({
      next: (datos) => {
        const labels = datos.map(d => d.categoria);
        const valores = datos.map(d => Number(d.total_vendido));
        this.inicializarGraficoCategorias(labels, valores);
      },
      error: err => console.error(err)
    });
  }

  inicializarGraficoCategorias(labels: string[], valores: number[]) {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.doughnutChart = new Chart(ctx, {
      type: 'doughnut', //tipo de grafico, torta o dona
      data: {
        labels, //categorias
        datasets: [{
          label: 'Ventas por categoría',
          data: valores,

          backgroundColor: [
            '#FF6384',
            '#36A2EB',
            '#FFCE56',
            '#4BC0C0',
            '#9966FF',
            '#FF9F40'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  }

  cargarGraficoIngresos() {
    this.estadisticaService.getIngresosPorFecha().subscribe({
      next: (datos) => {
        const fechas = datos.map(d => d.fecha_dia);
        const ingresos = datos.map(d => Number(d.total_ingresos));
        this.inicializarGraficoIngresos(fechas, ingresos);
      },
      error: err => console.error(err)
    });
  }

  inicializarGraficoIngresos(fechas: string[], ingresos: number[]) {
    const ctx = this.lineChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.lineChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: fechas,
        datasets: [{
          label: 'Ingresos',
          data: ingresos,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  cargarGraficoProductosMasVendidos() {
    this.estadisticaService.getProductosMasVendidos().subscribe({
      next: (datos) => {
        const productos = datos.map(d => d.producto);
        const cantidades = datos.map(d => Number(d.vendidos));
        this.inicializarGraficoProductosMasVendidos(
          productos,
          cantidades
        );
      },
      error: err => console.error(err)
    });
  }

  inicializarGraficoProductosMasVendidos(
    productos: string[],
    cantidades: number[]
  ) {
    const ctx = this.barChartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;
    this.barChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: productos,
        datasets: [
          {
            label: 'Cantidad vendida',
            data: cantidades,
            backgroundColor: '#36A2EB'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

}

