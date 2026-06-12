-- 版本表
CREATE TABLE IF NOT EXISTS versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  changes TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  link TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 设置表
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 主题市场表
CREATE TABLE IF NOT EXISTS themes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  repo_url TEXT NOT NULL,
  preview_url TEXT DEFAULT '',
  demo_url TEXT DEFAULT '',
  category TEXT DEFAULT '',
  source TEXT NOT NULL DEFAULT 'community',
  downloads INTEGER NOT NULL DEFAULT 0,
  zip_key TEXT DEFAULT '',
  zip_updated_at TEXT DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  premium_required INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 激活码表
CREATE TABLE IF NOT EXISTS premium_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  days INTEGER NOT NULL, -- -1=永久, >0=天数
  status TEXT NOT NULL DEFAULT 'unused', -- unused | used
  start_time TEXT, -- 激活开始时间（续费时=当前到期时间，否则=激活时间）
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_versions_date ON versions(date DESC);
CREATE INDEX IF NOT EXISTS idx_versions_enabled ON versions(enabled);
CREATE INDEX IF NOT EXISTS idx_announcements_created ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_themes_enabled ON themes(enabled);
CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category);
