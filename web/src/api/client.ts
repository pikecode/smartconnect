import axios, { AxiosResponse } from 'axios';

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta: unknown;
}

export const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

http.interceptors.response.use(
  (res: AxiosResponse<Envelope<unknown>>) => {
    const body = res.data;
    if (body.success) return body.data as unknown as AxiosResponse<unknown>;
    return Promise.reject(new Error(body.error?.message ?? '请求失败'));
  },
  (err) => Promise.reject(err),
);

export async function get<T>(url: string): Promise<T> {
  return (await http.get(url)) as unknown as T;
}

export async function post<T>(url: string, data?: unknown): Promise<T> {
  return (await http.post(url, data)) as unknown as T;
}

export async function put<T>(url: string, data?: unknown): Promise<T> {
  return (await http.put(url, data)) as unknown as T;
}

export async function del<T>(url: string): Promise<T> {
  return (await http.delete(url)) as unknown as T;
}