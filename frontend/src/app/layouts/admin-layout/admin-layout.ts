import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidebarAdmin } from '../../components/sidebar-admin/sidebar-admin';

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, SidebarAdmin],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.css',
})
export class AdminLayout {}
