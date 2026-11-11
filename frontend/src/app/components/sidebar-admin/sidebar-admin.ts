import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LoginApi } from '../../services/login-api';

@Component({
  selector: 'app-sidebar-admin',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar-admin.html',
  styleUrl: './sidebar-admin.css',
})
export class SidebarAdmin {

  constructor(
    public loginApi: LoginApi
  ) {}

  logout() {
    this.loginApi.logout();
  }
}
