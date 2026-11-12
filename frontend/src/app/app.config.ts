import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
// 1. Importa el proveedor HTTP y la función para habilitar interceptores funcionales
import { provideHttpClient, withInterceptors } from '@angular/common/http';
// 2. Importa tu interceptor funcional (ajusta la ruta de la carpeta si es necesario)
import { tokenInterceptor } from './services/token-interceptor';


export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // 3. Registra el cliente HTTP con tu interceptor funcional
    provideHttpClient(
      withInterceptors([tokenInterceptor])
    )
  ]
};