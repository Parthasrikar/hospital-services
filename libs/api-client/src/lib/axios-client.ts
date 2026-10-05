import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';

// Default API Base URL (browser-safe environment check via globalThis)
const globalEnv = (globalThis as Record<string, any>)['process']?.env;
const API_BASE_URL = globalEnv?.['API_BASE_URL'] || 'http://localhost:3000/api';

// Create configured Axios instance
export const axiosClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // MANDATORY for HTTP-Only Cookies
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Flag and queue to handle concurrent 401 token refresh retries
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve();
    }
  });
  failedQueue = [];
};

// Request Interceptor
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Custom header triggers can be set here if needed
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor with Automatic 401 Refresh Retry
axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Ignore 401 errors from login/register/refresh endpoints to prevent infinite loops
    const isAuthEndpoint =
      originalRequest?.url?.includes('/auth/login') ||
      originalRequest?.url?.includes('/auth/register') ||
      originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Attempt to refresh tokens via HTTP-Only cookie at /auth/refresh
        await axiosClient.post('/auth/refresh');
        processQueue(null);
        return axiosClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError);
        // Clear state / trigger redirect to login if refresh fails
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
