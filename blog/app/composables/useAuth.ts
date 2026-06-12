import type { ApiResponse } from '@@/types/request';
import type { WechatQRState } from '@@/types/auth';

const ACCESS_TOKEN_KEY = 'access_token';

/**
 * 获取存储的 access token
 * @returns {string | null} access token字符串或null
 */
const getStoredToken = (): string | null => {
  if (import.meta.server) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const accessToken = ref<string | null>(getStoredToken());

// 响应式登录状态
export const isLoggedIn = computed(() => !!accessToken.value && accessToken.value !== '');

/**
 * 设置 access token
 */
export const setAccessToken = (access: string): void => {
  if (import.meta.client) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
  }
  accessToken.value = access;
};

/**
 * 获取 access token
 */
export const getAccessToken = (): string | null => {
  if (import.meta.client) {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }
  return accessToken.value;
};

/**
 * 清除 access token
 */
export const clearAccessToken = (): void => {
  if (import.meta.client) {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  accessToken.value = null;
};

/**
 * 登出操作
 */
export const logout = (): void => {
  const token = accessToken.value;
  clearAccessToken();

  if (token) {
    const config = useRuntimeConfig();
    $fetch<ApiResponse<void>>('/auth/logout', {
      method: 'POST',
      baseURL: config.public.apiUrl as string,
      headers: {
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    }).catch(() => {});
  }
};

/**
 * 获取响应式的登录状态
 */
export const useAuth = () => isLoggedIn;

/**
 * 构建 OAuth 认证 URL
 */
export function buildOAuthUrl(
  provider: string,
  options: { redirect?: string; action?: 'bind' } = {}
): string {
  const config = useRuntimeConfig();
  const base = `${config.public.apiUrl}/auth/${provider}`;
  const params = new URLSearchParams();
  if (options.action) params.set('action', options.action);
  if (options.action === 'bind' && accessToken.value) {
    params.set('token', accessToken.value);
  }
  if (options.redirect) params.set('redirect', options.redirect);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// ============================================================
// 微信扫码登录
// ============================================================

export function useWechatLogin(options: { onSuccess: () => void }) {
  const { fetchUserInfo, setToken, pollWechatLoginStatus } = useUser();

  const qrState = ref<WechatQRState>({
    visible: false,
    imageUrl: '',
    scene: '',
    status: 'idle',
    error: '',
  });

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const clearPoll = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };

  const startPoll = (scene: string) => {
    clearPoll();
    let elapsed = 0;
    pollTimer = setInterval(async () => {
      elapsed += 2;
      if (elapsed > 300) {
        qrState.value = { ...qrState.value, status: 'expired', error: '二维码已过期' };
        clearPoll();
        return;
      }
      try {
        const res = await pollWechatLoginStatus(scene);
        if (res.status === 'confirmed' && res.access_token) {
          clearPoll();
          setToken(res.access_token);
          await fetchUserInfo();
          options.onSuccess();
        } else if (res.status === 'expired') {
          qrState.value = { ...qrState.value, status: 'expired', error: '二维码已过期' };
          clearPoll();
        }
      } catch {
        // 轮询失败静默忽略
      }
    }, 2000);
  };

  const showQR = async () => {
    qrState.value = { visible: true, imageUrl: '', scene: '', status: 'loading', error: '' };
    try {
      const config = useRuntimeConfig();
      const resp = await $fetch.raw(`${config.public.apiUrl}/auth/wechat/qrcode`, {
        responseType: 'blob',
      });
      const blob = resp._data as Blob;
      const scene = resp.headers.get('X-Scene') || '';
      qrState.value = {
        visible: true,
        imageUrl: URL.createObjectURL(blob),
        scene,
        status: 'scanning',
        error: '',
      };
      startPoll(scene);
    } catch {
      qrState.value = { ...qrState.value, status: 'error', error: '获取二维码失败' };
    }
  };

  const refresh = () => showQR();

  const dismiss = () => {
    clearPoll();
    if (qrState.value.imageUrl) {
      URL.revokeObjectURL(qrState.value.imageUrl);
    }
    qrState.value = { visible: false, imageUrl: '', scene: '', status: 'idle', error: '' };
  };

  onUnmounted(clearPoll);

  return { qrState, showQR, refresh, dismiss };
}
