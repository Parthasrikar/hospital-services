import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

export interface HttpOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  errorHandler?: (error: HttpErrorResponse) => Observable<never>;
}

@Injectable({
  providedIn: 'root',
})
export class BaseService {
  protected http = inject(HttpClient);

  protected get<T>(url: string, options?: HttpOptions): Observable<T> {
    return this.http.get<T>(url, options).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, options?.errorHandler))
    );
  }

  protected post<T>(url: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.post<T>(url, body, options).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, options?.errorHandler))
    );
  }

  protected put<T>(url: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.put<T>(url, body, options).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, options?.errorHandler))
    );
  }

  protected patch<T>(url: string, body: unknown, options?: HttpOptions): Observable<T> {
    return this.http.patch<T>(url, body, options).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, options?.errorHandler))
    );
  }

  protected delete<T>(url: string, options?: HttpOptions): Observable<T> {
    return this.http.delete<T>(url, options).pipe(
      catchError((error: HttpErrorResponse) => this.handleError(error, options?.errorHandler))
    );
  }

  private handleError(
    error: HttpErrorResponse,
    customHandler?: (error: HttpErrorResponse) => Observable<never>
  ): Observable<never> {
    if (customHandler) {
      return customHandler(error);
    }
    // Standard error rethrow
    return throwError(() => error);
  }
}
