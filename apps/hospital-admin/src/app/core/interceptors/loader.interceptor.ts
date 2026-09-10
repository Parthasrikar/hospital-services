import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { GlobalLoaderService } from '../services/loader.service';

export const loaderInterceptor: HttpInterceptorFn = (req, next) => {
  const loader = inject(GlobalLoaderService);
  
  // Skip loader for background/polling endpoints if header present
  if (req.headers.has('X-Skip-Loader')) {
    return next(req);
  }

  loader.show();
  return next(req).pipe(
    finalize(() => loader.hide())
  );
};
