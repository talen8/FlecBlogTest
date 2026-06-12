import type { ThemeSchemaResponse } from '@@/types/theme';
import { createApi } from './createApi';

const themeApi = createApi<ThemeSchemaResponse>('/themes');

/** 获取当前激活主题的 Schema 和 Config（公开接口） */
export const getActiveThemeSchema = async (): Promise<ThemeSchemaResponse> => {
  return themeApi.get<ThemeSchemaResponse>('/active/schema');
};
