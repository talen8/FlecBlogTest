import request from '@/utils/request';
import type {
  SystemStatic,
  SystemDynamic,
  CheckUpdateResponse,
  UpgradeStatus,
} from '@/types/system';

/**
 * 获取系统静态信息
 * @returns Promise<SystemStatic>
 */
export function getSystemStatic(): Promise<SystemStatic> {
  return request.get('/admin/system/static');
}

/**
 * 获取系统动态信息
 * @returns Promise<SystemDynamic>
 */
export function getSystemDynamic(): Promise<SystemDynamic> {
  return request.get('/admin/system/dynamic');
}

/**
 * 检查版本更新
 * @returns Promise<CheckUpdateResponse>
 */
export function checkUpdate(): Promise<CheckUpdateResponse> {
  return request.post('/admin/system/check-update');
}

/**
 * 启动系统升级
 * @param target 升级目标：blog | server | all
 * @returns Promise<null>
 */
export function startUpgrade(target: 'blog' | 'server' | 'all'): Promise<null> {
  return request.post('/admin/system/upgrade', { target });
}

/**
 * 查询升级进度
 * @returns Promise<UpgradeStatus>
 */
export function getUpgradeStatus(): Promise<UpgradeStatus> {
  return request.get('/admin/system/upgrade/status');
}
