import request from '@/utils/request';
import type {
  Theme,
  ThemeListItem,
  ThemeInstallResponse,
  ThemeActivateResponse,
  ThemeConfigUpdateRequest,
  MenuDataItem,
  MenuUpdateRequest,
} from '@/types/theme';

/** 通过 slug 从市场下载并安装主题 */
export function installThemeBySlug(slug: string): Promise<ThemeInstallResponse> {
  return request.post(`/admin/themes/${slug}/market-install`);
}

/** 获取主题列表 */
export function getThemes(): Promise<ThemeListItem[]> {
  return request.get('/admin/themes');
}

/** 获取主题详情 */
export function getTheme(slug: string): Promise<Theme> {
  return request.get(`/admin/themes/${slug}`);
}

/** 从 ZIP 文件安装主题 */
export function installThemeFromZip(file: File): Promise<ThemeInstallResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return request.post('/admin/themes/install', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

/** 激活主题 */
export function activateTheme(slug: string): Promise<ThemeActivateResponse> {
  return request.post(`/admin/themes/${slug}/activate`);
}

/** 更新主题配置 */
export function updateThemeConfig(
  slug: string,
  data: ThemeConfigUpdateRequest
): Promise<Record<string, unknown>> {
  return request.put(`/admin/themes/${slug}/config`, data);
}

/** 删除主题 */
export function deleteTheme(slug: string): Promise<void> {
  return request.delete(`/admin/themes/${slug}`);
}

// ============ 任务状态 ============

export interface ThemeTaskProgress {
  target: string;
  status: string;
  message: string;
  progress?: number;
}

/** 获取当前主题任务状态（安装/升级/激活/重建） */
export function getThemeTaskStatus(): Promise<ThemeTaskProgress> {
  return request.get('/admin/themes/task-status');
}

// ============ 主题菜单 ============

/** 获取主题菜单数据 */
export function getThemeMenus(slug: string, type?: string): Promise<MenuDataItem[]> {
  return request.get(`/admin/themes/${slug}/menus`, { params: { type } });
}

/** 更新主题菜单（整体替换某个 type 的菜单列表） */
export function updateThemeMenus(slug: string, data: MenuUpdateRequest): Promise<void> {
  return request.put(`/admin/themes/${slug}/menus`, data);
}
