import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoginApi } from './login-api';
export const tokenInterceptor: HttpInterceptorFn = (req, next) => {
    // Usamos inject() para obtener el servicio dentro de la función
    const loginApi = inject(LoginApi);
    const token = loginApi.getToken();
    // Clonamos la petición solo si existe un token
    if (token) {
        const tokenizeReq = req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        });
        return next(tokenizeReq);
    }
    return next(req);
};