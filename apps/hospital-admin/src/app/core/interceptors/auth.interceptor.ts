import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Always include credentials (HTTP-Only Cookies) on outgoing API requests
  const authReq = req.clone({
    withCredentials: true,
  });

  return next(authReq);
};

