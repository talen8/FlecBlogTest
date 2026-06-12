import type {
  UserInfo,
  LoginParams,
  RegisterParams,
  ForgotPasswordParams,
  ResetPasswordParams,
  ChangePasswordParams,
  DeactivateAccountParams,
  UpdateProfileParams,
  LoginResponse,
  RegisterResponse,
} from '@@/types/user';
import {
  getUserProfile,
  updateUserProfile as updateProfileApi,
  login as loginApi,
  register as registerApi,
  forgotPassword as forgotPasswordApi,
  resetPassword as resetPasswordApi,
  changePassword as changePasswordApi,
  setPassword as setPasswordApi,
  deactivateAccount as deactivateAccountApi,
  unbindOAuth as unbindOAuthApi,
  pollWechatLoginStatus as pollWechatApi,
} from '@/composables/api/user';

const userInfo = ref<UserInfo | null>(null);

const showLoginModal = ref(false);

export function useLoginModal() {
  const open = () => {
    showLoginModal.value = true;
  };

  const close = () => {
    showLoginModal.value = false;
  };

  return {
    showLoginModal,
    open,
    close,
  };
}

// 邮箱绑定提示相关状态
const GLOBAL_REMIND_INTERVAL = 12 * 60 * 60 * 1000;
const COMMENT_REMIND_INTERVAL = 10 * 60 * 1000;
const SKIP_TIME_KEY = 'bindEmailSkipTime';
const showBindEmailModal = ref(false);
type TriggerType = 'global' | 'comment';

export function useBindEmail() {
  const shouldShowPrompt = async (
    trigger: TriggerType,
    userInfo?: UserInfo | null
  ): Promise<boolean> => {
    if (!isLoggedIn.value) return false;
    let user = userInfo;
    if (!user) {
      try {
        user = await getUserProfile();
      } catch {
        return false;
      }
    }
    if (!user?.is_virtual_email) return false;
    const skipTime = localStorage.getItem(SKIP_TIME_KEY);
    if (skipTime) {
      const elapsed = Date.now() - parseInt(skipTime, 10);
      const interval = trigger === 'comment' ? COMMENT_REMIND_INTERVAL : GLOBAL_REMIND_INTERVAL;
      if (elapsed < interval) return false;
    }
    return true;
  };

  const triggerGlobal = async (userInfo?: UserInfo | null) => {
    if (await shouldShowPrompt('global', userInfo)) {
      showBindEmailModal.value = true;
    }
  };

  const triggerOnComment = async () => {
    if (await shouldShowPrompt('comment')) {
      showBindEmailModal.value = true;
    }
  };

  const onBindSuccess = () => {
    localStorage.removeItem(SKIP_TIME_KEY);
  };

  const onSkip = () => {
    localStorage.setItem(SKIP_TIME_KEY, String(Date.now()));
  };

  return { showBindEmailModal, triggerGlobal, triggerOnComment, onBindSuccess, onSkip };
}

export function useUser() {
  const isLoggedIn = useAuth();
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchUserInfo = async () => {
    if (!isLoggedIn.value) {
      userInfo.value = null;
      return null;
    }
    loading.value = true;
    error.value = null;
    try {
      const data = await getUserProfile();
      userInfo.value = data;
      return data;
    } catch (e) {
      console.error('获取用户信息失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      userInfo.value = null;
      return null;
    } finally {
      loading.value = false;
    }
  };

  const clearUserInfo = () => {
    userInfo.value = null;
  };

  async function login(params: LoginParams): Promise<LoginResponse> {
    return loginApi(params);
  }

  async function register(params: RegisterParams): Promise<RegisterResponse> {
    return registerApi(params);
  }

  async function forgotPassword(params: ForgotPasswordParams): Promise<void> {
    return forgotPasswordApi(params);
  }

  async function resetPassword(params: ResetPasswordParams): Promise<void> {
    return resetPasswordApi(params);
  }

  async function changePassword(params: ChangePasswordParams): Promise<void> {
    return changePasswordApi(params);
  }

  async function setPassword(params: {
    password: string;
    confirm_password: string;
  }): Promise<void> {
    return setPasswordApi(params);
  }

  async function updateUserProfile(params: UpdateProfileParams): Promise<UserInfo> {
    const data = await updateProfileApi(params);
    userInfo.value = data;
    return data;
  }

  async function deactivateAccount(params: DeactivateAccountParams): Promise<void> {
    return deactivateAccountApi(params);
  }

  async function unbindOAuth(provider: string): Promise<void> {
    return unbindOAuthApi(provider);
  }

  function setToken(token: string): void {
    setAccessToken(token);
  }

  async function pollWechatLoginStatus(scene: string) {
    return pollWechatApi(scene);
  }

  return {
    userInfo,
    userAvatar: computed(() => getAvatarUrl(userInfo.value || {})),
    userNickname: computed(() => userInfo.value?.nickname || '用户'),
    userEmail: computed(() => userInfo.value?.email || ''),
    loading,
    error,
    fetchUserInfo,
    clearUserInfo,
    login,
    register,
    forgotPassword,
    resetPassword,
    changePassword,
    setPassword,
    updateUserProfile,
    deactivateAccount,
    unbindOAuth,
    setToken,
    pollWechatLoginStatus,
    getUserProfile: fetchUserInfo,
  };
}
