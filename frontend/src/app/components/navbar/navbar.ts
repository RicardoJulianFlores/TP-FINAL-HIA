import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CarritoService } from '../../services/carrito';
import { LoginApi } from '../../services/login-api';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar implements OnInit {

  cantidadCarrito = 0;

  constructor(
    private carritoService: CarritoService,
    private cdr: ChangeDetectorRef,
    public loginApi: LoginApi
  ) {}

  ngOnInit(): void {
    this.carritoService.items$.subscribe(items => {
      this.cantidadCarrito = items.reduce((acc, i) => acc + i.cantidad, 0);
      this.cdr.detectChanges();
    });
  }

  logout() {
    this.loginApi.logout();
    this.carritoService.vaciar();
  }
}