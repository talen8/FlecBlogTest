import { $fetch } from 'ofetch';
import type { FetchOptions } from 'ofetch';
import { accessToken, setAccessToken, logout } from '../useAuth';
import type { ApiResponse, PaginationData, PaginationQuery } from '@@/types/request';

// ========== HTTP 请求基础设施 ==========

type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'PATCH'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'CONNECT'
  | 'OPTIONS'
  | 'TRACE';

// Token 刷新状态
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// 刷新 Token
const doRefreshToken = async (): Promise<boolean> => {
  try {
    const res = await $fetch<ApiResponse<{ access_token: string }>>('/auth/refresh', {
      method: 'POST',
      baseURL: useRuntimeConfig().public.apiUrl as string,
      credentials: 'include',
    });
    if (res.code === 0 && res.data) {
      setAccessToken(res.data.access_token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// 封装请求，支持自动 Token 注入和 401 刷新
/* eslint-disable @typescript-eslint/no-explicit-any -- 通用请求封装，返回类型由调用方指定 */
async function apiRequest<T = any>(
  url: string,
  options: Omit<FetchOptions, 'method'> & { method?: HttpMethod; _retry?: boolean } = {}
): Promise<T> {
  const config = useRuntimeConfig();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };

  if (accessToken.value && url !== '/auth/refresh') {
    headers['Authorization'] = `Bearer ${accessToken.value}`;
  }

  try {
    const response = await $fetch<T>(url, {
      ...options,
      baseURL: config.public.apiUrl,
      headers,
      credentials: 'include',
    } as any);

    // 后端返回 HTTP 200 但业务 code 非 0 时，视为错误
    if (
      response &&
      typeof response === 'object' &&
      'code' in response &&
      (response as any).code !== 0
    ) {
      const err = new Error((response as any).message || '请求失败') as any;
      err.response = { data: response };
      throw err;
    }

    return response;
  } catch (error: any) {
    // 401 自动刷新 token
    if (error?.response?.status === 401 && !options._retry) {
      if (!isRefreshing) {
        isRefreshing = true;
        refreshPromise = doRefreshToken().finally(() => {
          isRefreshing = false;
        });
      }

      const success = await refreshPromise;
      if (success) {
        return apiRequest<T>(url, { ...options, _retry: true });
      }
      logout();
    }
    throw error;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* eslint-disable @typescript-eslint/no-explicit-any -- 通用请求封装，返回类型/请求体由调用方指定 */
async function get<T = any>(url: string, options: Omit<FetchOptions, 'method'> = {}): Promise<T> {
  return await apiRequest<T>(url, { ...options, method: 'GET' });
}

async function post<T = any>(
  url: string,
  body?: any,
  options: Omit<FetchOptions, 'method'> = {}
): Promise<T> {
  return await apiRequest<T>(url, { ...options, method: 'POST', body });
}

async function put<T = any>(
  url: string,
  body?: any,
  options: Omit<FetchOptions, 'method'> = {}
): Promise<T> {
  return await apiRequest<T>(url, { ...options, method: 'PUT', body });
}

async function patch<T = any>(
  url: string,
  body?: any,
  options: Omit<FetchOptions, 'method'> = {}
): Promise<T> {
  return await apiRequest<T>(url, { ...options, method: 'PATCH', body });
}

async function del<T = any>(url: string, options: Omit<FetchOptions, 'method'> = {}): Promise<T> {
  return await apiRequest<T>(url, { ...options, method: 'DELETE' });
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ========== API 工厂 ==========

interface ApiFactoryOptions {
  stringifyTargetKey?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 转换函数，输入输出类型由调用方决定
  transformParams?: (params: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 转换函数，输入输出类型由调用方决定
  transformBody?: (body: any) => any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 处理任意数据结构
function processData(data: any, options: ApiFactoryOptions, isBody: boolean) {
  let processed = { ...data };

  if (options.stringifyTargetKey && processed.target_key !== undefined) {
    processed.target_key = String(processed.target_key);
  }

  const transformFn = isBody ? options.transformBody : options.transformParams;
  if (transformFn) {
    processed = transformFn(processed);
  }

  return processed;
}

export function createApi<T>(endpoint: string, options: ApiFactoryOptions = {}) {
  return {
    getList: async (params?: Partial<PaginationQuery>): Promise<PaginationData<T>> => {
      const response = await get<ApiResponse<PaginationData<T>>>(endpoint, {
        params: processData(params, options, false),
      });
      return response.data;
    },

    getOne: async (id: number | string): Promise<T> => {
      const response = await get<ApiResponse<T>>(`${endpoint}/${id}`);
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    create: async (data: any): Promise<T> => {
      const response = await post<ApiResponse<T>>(endpoint, processData(data, options, true));
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    update: async (id: number | string, data: any): Promise<T> => {
      const response = await put<ApiResponse<T>>(
        `${endpoint}/${id}`,
        processData(data, options, true)
      );
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    patch: async (id: number | string, data: any): Promise<T> => {
      const response = await patch<ApiResponse<T>>(
        `${endpoint}/${id}`,
        processData(data, options, true)
      );
      return response.data;
    },

    delete: async (id: number | string): Promise<void> => {
      await del(`${endpoint}/${id}`);
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 参数类型由调用方决定
    get: async <R = T>(url: string, params?: any): Promise<R> => {
      const response = await get<ApiResponse<R>>(`${endpoint}${url}`, {
        params: processData(params, options, false),
      });
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    post: async <R = T>(url: string, data?: any): Promise<R> => {
      const response = await post<ApiResponse<R>>(
        `${endpoint}${url}`,
        processData(data, options, true)
      );
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    put: async <R = T>(url: string, data?: any): Promise<R> => {
      const response = await put<ApiResponse<R>>(
        `${endpoint}${url}`,
        processData(data, options, true)
      );
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    patchRequest: async <R = T>(url: string, data?: any): Promise<R> => {
      const response = await patch<ApiResponse<R>>(
        `${endpoint}${url}`,
        processData(data, options, true)
      );
      return response.data;
    },

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 数据类型由调用方决定
    deleteRequest: async (url: string, data?: any): Promise<void> => {
      await del(`${endpoint}${url}`, {
        body: processData(data, options, true),
      });
    },
  };
}
