/** 微信扫码登录状态 */
export interface WechatQRState {
  visible: boolean;
  imageUrl: string;
  scene: string;
  status: 'idle' | 'loading' | 'scanning' | 'confirmed' | 'expired' | 'error';
  error: string;
}
