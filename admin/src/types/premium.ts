/** 会员状态 */
export interface PremiumStatus {
  active: boolean; // true=高级会员, false=普通会员
  days_remaining: number; // 0=普通会员, -1=永久, >0=剩余天数
  start_time?: string;
}

/** 会员激活请求 */
export interface PremiumActivateRequest {
  code: string;
}
