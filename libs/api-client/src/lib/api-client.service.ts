import { Injectable } from '@angular/core';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { from, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { axiosClient } from './axios-client';

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  /**
   * Returns API Base URL string
   */
  getBaseUrl(): string {
    return (axiosClient.defaults.baseURL as string) || 'http://localhost:3000/api';
  }

  /**
   * HTTP GET Request returning RxJS Observable<T>
   */
  get<T>(url: string, config?: AxiosRequestConfig): Observable<T> {
    return from(axiosClient.get<T>(url, config)).pipe(map((res: AxiosResponse<T>) => res.data));
  }

  /**
   * HTTP POST Request returning RxJS Observable<T>
   */
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<T> {
    return from(axiosClient.post<T>(url, data, config)).pipe(map((res: AxiosResponse<T>) => res.data));
  }

  /**
   * HTTP PUT Request returning RxJS Observable<T>
   */
  put<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<T> {
    return from(axiosClient.put<T>(url, data, config)).pipe(map((res: AxiosResponse<T>) => res.data));
  }

  /**
   * HTTP PATCH Request returning RxJS Observable<T>
   */
  patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Observable<T> {
    return from(axiosClient.patch<T>(url, data, config)).pipe(map((res: AxiosResponse<T>) => res.data));
  }

  /**
   * HTTP DELETE Request returning RxJS Observable<T>
   */
  delete<T>(url: string, config?: AxiosRequestConfig): Observable<T> {
    return from(axiosClient.delete<T>(url, config)).pipe(map((res: AxiosResponse<T>) => res.data));
  }

  /**
   * Direct Async/Await Axios Calls
   */
  async getAsync<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosClient.get<T>(url, config);
    return res.data;
  }

  async postAsync<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const res = await axiosClient.post<T>(url, data, config);
    return res.data;
  }
}
