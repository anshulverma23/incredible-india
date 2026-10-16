import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { getToken, setToken, clearToken } from "@/lib/storage";

/** Thrown for any non-2xx response, carrying the backend's message so callers catch a single error type. */
export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export type QueryParams = Record<string, unknown>;

/** Drops empty values (undefined / null / "") before building the query string. */
const serializeParams = (params: QueryParams) => {
  const clean = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  return new URLSearchParams(clean as [string, string][]).toString();
};

export const http = axios.create({
  baseURL: env.API_URL,
  paramsSerializer: { serialize: serializeParams },
  withCredentials: true, // sends the httpOnly refresh-token cookie to /auth/*
});

// Attach the (short-lived) access token to every request.
http.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

/* ------------------------------------------------------------------ */
/* Silent token refresh: access tokens last 15 min, the refresh cookie  */
/* lasts days. On a 401 we rotate once, then replay the failed request.  */
/* ------------------------------------------------------------------ */
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = (): Promise<string | null> => {
  refreshing ??= axios
    .post<{ token: string }>(`${env.API_URL}/auth/refresh`, undefined, { withCredentials: true })
    .then((r) => {
      setToken(r.data.token);
      return r.data.token;
    })
    .catch(() => {
      clearToken();
      return null;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
};

type RetriableConfig = InternalAxiosRequestConfig & { _retried?: boolean };
const AUTH_ENDPOINTS = ["/auth/login", "/auth/register", "/auth/refresh", "/auth/google", "/auth/forgot-password", "/auth/reset-password"];

// Normalise HTTP error responses into ApiError. Network failures (no response) are passed through untouched.
http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && error.response) {
      const original = error.config as RetriableConfig | undefined;
      const isAuthCall = AUTH_ENDPOINTS.some((p) => original?.url?.includes(p));

      if (error.response.status === 401 && original && !original._retried && !isAuthCall && getToken()) {
        original._retried = true;
        const fresh = await refreshAccessToken();
        if (fresh) {
          original.headers.set("Authorization", `Bearer ${fresh}`);
          return http(original);
        }
      }

      const { data, status } = error.response;
      const body = typeof data === "object" && data !== null ? (data as { message?: string; details?: unknown }) : null;
      return Promise.reject(new ApiError(body?.message || (body ? "Something went wrong" : "Request failed"), status, body?.details));
    }
    return Promise.reject(error);
  },
);

/** Thin typed helpers that resolve straight to the response body. FormData bodies are sent as multipart automatically. */
export const api = {
  get: <T = unknown>(url: string, params?: QueryParams) =>
    http.get<T>(url, { params }).then((r) => r.data),
  post: <T = unknown>(url: string, body?: unknown, config?: AxiosRequestConfig) =>
    http.post<T>(url, body, config).then((r) => r.data),
  put: <T = unknown>(url: string, body?: unknown) =>
    http.put<T>(url, body).then((r) => r.data),
  delete: <T = unknown>(url: string) => http.delete<T>(url).then((r) => r.data),
};
