import request from '@/utils/request';
import type { PremiumStatus, PremiumActivateRequest } from '@/types/premium';

/** 查询当前站点会员状态 */
export function getPremiumStatus(): Promise<PremiumStatus> {
  return request.get('/admin/premium/status');
}

/** 激活会员 */
export function activatePremium(data: PremiumActivateRequest): Promise<PremiumStatus> {
  return request.post('/admin/premium/activate', data);
}
