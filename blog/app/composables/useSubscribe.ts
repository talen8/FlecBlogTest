import { subscribe as subscribeApi, unsubscribe as unsubscribeApi } from './api/subscribe';

export function useSubscribe() {
  const subscribe = async (email: string) => {
    return subscribeApi(email);
  };

  const unsubscribe = async (token: string) => {
    return unsubscribeApi(token);
  };

  return { subscribe, unsubscribe };
}
