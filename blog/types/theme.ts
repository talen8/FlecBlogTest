/** 菜单项接口 */
export interface Menu {
  id: number;
  title: string;
  url: string;
  icon: string;
  sort: number;
  is_enabled: boolean;
  children?: Menu[];
}

export interface ThemeSchemaResponse {
  slug: string;
  name: string;
  schema: Record<string, unknown>;
  config: Record<string, unknown>;
  menus: Record<string, Menu[]>;
}

export interface ThemeState {
  slug: string;
  name: string;
  schema: Record<string, unknown>;
  config: Record<string, unknown>;
  loaded: boolean;
}
