import { createApi } from './createApi';

const subscribeApi = createApi<{ message: string }>('/subscribe');

/** 邮件订阅 */
export const subscribe = async (email: string) => {
  return subscribeApi.post<{ message: string }>('', { email });
};

/** 退订 */
export const unsubscribe = async (token: string) => {
  return subscribeApi.get<{ message: string }>('/unsubscribe', { token });
};
