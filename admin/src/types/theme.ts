// ============ 菜单类型 ============

// 菜单项（JSON 存储结构，嵌套 children）
export interface MenuDataItem {
  id: number;
  title: string;
  url: string;
  icon: string;
  sort: number;
  is_enabled: boolean;
  children: MenuDataItem[];
}

// 更新菜单请求（整体替换某个 type 的菜单列表）
export interface MenuUpdateRequest {
  type: string;
  items: MenuDataItem[];
}

// 主题菜单槽位声明（从 schema 中解析）
export interface MenuSlot {
  key: string;
  label: string;
  maxDepth: number;
}

// 主题列表项
export interface ThemeListItem {
  slug: string;
  name: string;
  is_active: boolean;
  version: string;
  latest_version?: string;
  author: string;
  description: string;
  cover: string;
  license: string;
  repo: string;
  created_at: string;
  updated_at: string;
}

/** 主题 Schema 中的单个字段定义 */
export interface SchemaField {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  title?: string;
  description?: string;
  default?: unknown;
  enum?: string[] | Array<{ label: string; value: string }>;
  format?: string;
  placeholder?: string;
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  'x-item-fields'?: Array<string | Record<string, unknown>>;
}

/** 主题 Schema：允许任意嵌套分组，叶子节点为 SchemaField */
export interface ThemeSchema {
  [key: string]: SchemaField | ThemeSchema;
}

// 主题详情
export interface Theme {
  slug: string;
  name: string;
  is_active: boolean;
  author: string;
  description: string;
  cover: string;
  license: string;
  repo: string;
  config: Record<string, unknown>;
  schema: ThemeSchema;
  menus: Record<string, MenuDataItem[]>;
  version: string;
  created_at: string;
  updated_at: string;
}

// 主题安装响应
export interface ThemeInstallResponse {
  slug: string;
  name: string;
  version: string;
  is_active: boolean;
  message: string;
}

// 主题激活响应
export interface ThemeActivateResponse {
  slug: string;
  name: string;
  message: string;
}

// 主题 Schema 响应
export interface ThemeSchemaResponse {
  slug: string;
  name: string;
  schema: ThemeSchema;
}

// 主题配置更新请求
export interface ThemeConfigUpdateRequest {
  config: Record<string, unknown>;
}
