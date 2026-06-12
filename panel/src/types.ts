/**
 * 类型定义
 * 包含所有业务实体类型和环境类型
 */

/** 版本信息 */
export interface Version {
  id?: number;
  version: string;
  date: string;
  changes: string;
  enabled: boolean;
  created_at?: string;
}

/** 公告信息 */
export interface Announcement {
  id: number;
  title: string;
  content: string;
  link?: string;
  created_at: string;
}

/** 环境变量 */
export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  THEME_ASSETS?: R2Bucket;
  R2_PUBLIC_URL?: string;
  PANEL_API_KEY: string;
}

/** 设置项 */
export interface Setting {
  key: string;
  value: string;
  updated_at?: string;
}

/** 主题市场 */
export interface Theme {
  id?: number;
  slug: string;
  name: string;
  author: string;
  description: string;
  version?: string;
  repo_url: string;
  preview_url: string;
  demo_url: string;
  category: string;
  source: string;
  downloads: number;
  zip_key?: string;
  zip_updated_at?: string;
  enabled: boolean;
  premium_required: boolean;
  created_at?: string;
  updated_at?: string;
}

/** 激活码 */
export interface PremiumCode {
  id?: number;
  code: string;
  days: number; // -1=永久, >0=天数
  status: string; // unused | used
  start_time?: string; // 激活开始时间
  created_at?: string;
}
