/**
 * 数据库服务
 * 提供所有数据库操作方法
 */

import { Env, Version, Announcement, Setting, Theme } from '../types';

/**
 * 获取设置值
 */
export async function getSetting(env: Env, key: string): Promise<string | null> {
  const result = await env.DB.prepare('SELECT value FROM settings WHERE key = ?')
    .bind(key)
    .first<Setting>();

  return result?.value || null;
}

/**
 * 获取启用的版本列表
 */
export async function getEnabledVersions(env: Env, limit: number): Promise<Version[]> {
  const result = await env.DB.prepare(
    'SELECT id, version, date, changes FROM versions WHERE enabled = 1 ORDER BY date DESC LIMIT ?'
  )
    .bind(limit)
    .all<Version>();

  return result.results;
}

/**
 * 获取所有版本列表
 */
export async function getAllVersions(env: Env): Promise<Version[]> {
  const result = await env.DB.prepare(
    'SELECT * FROM versions ORDER BY date DESC'
  )
    .all<Version>();

  return result.results;
}

/**
 * 获取公告列表（公开接口，最近1天）
 */
export async function getPublicAnnouncements(env: Env): Promise<Announcement[]> {
  const result = await env.DB.prepare(
    `SELECT id, title, content, link FROM announcements
     WHERE created_at >= datetime('now', '-1 day')
     ORDER BY created_at DESC`
  ).all<Announcement>();

  return result.results;
}

/**
 * 获取所有公告列表（管理接口）
 */
export async function getAnnouncements(env: Env): Promise<Announcement[]> {
  const result = await env.DB.prepare(
    'SELECT id, title, content, link, created_at FROM announcements ORDER BY created_at DESC'
  ).all<Announcement>();

  return result.results;
}

// ============ 主题市场 ============

/**
 * 获取公开主题列表（支持分类和关键词筛选）
 */
export async function getPublicThemes(env: Env, category?: string, keyword?: string): Promise<Theme[]> {
  let sql = 'SELECT * FROM themes WHERE enabled = 1';
  const params: (string | number)[] = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR description LIKE ? OR author LIKE ?)';
    const like = `%${keyword}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY downloads DESC, created_at DESC';

  const result = await env.DB.prepare(sql).bind(...params).all<Theme>();
  return result.results;
}

/**
 * 根据 slug 获取主题详情
 */
export async function getThemeBySlug(env: Env, slug: string): Promise<Theme | null> {
  const result = await env.DB.prepare('SELECT * FROM themes WHERE slug = ?')
    .bind(slug)
    .first<Theme>();
  return result || null;
}

/**
 * 获取全部主题（管理接口，含 disabled）
 */
export async function getAllThemes(env: Env): Promise<Theme[]> {
  const result = await env.DB.prepare('SELECT * FROM themes ORDER BY created_at DESC').all<Theme>();
  return result.results;
}

/**
 * 创建主题
 */
export async function createTheme(env: Env, theme: Omit<Theme, 'id' | 'downloads' | 'created_at' | 'updated_at'>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO themes (slug, name, author, description, version, repo_url, preview_url, demo_url, category, source, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      theme.slug, theme.name, theme.author, theme.description, theme.version || '1.0.0',
      theme.repo_url, theme.preview_url, theme.demo_url, theme.category, theme.source || 'community', theme.enabled ? 1 : 0
    )
    .run();
}

/**
 * 更新主题
 */
export async function updateTheme(env: Env, slug: string, updates: Partial<Theme>): Promise<void> {
  const fields: string[] = [];
  const values: (string | number)[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.author !== undefined) { fields.push('author = ?'); values.push(updates.author); }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
  if (updates.version !== undefined) { fields.push('version = ?'); values.push(updates.version); }
  if (updates.repo_url !== undefined) { fields.push('repo_url = ?'); values.push(updates.repo_url); }
  if (updates.preview_url !== undefined) { fields.push('preview_url = ?'); values.push(updates.preview_url); }
  if (updates.demo_url !== undefined) { fields.push('demo_url = ?'); values.push(updates.demo_url); }
  if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
  if (updates.source !== undefined) { fields.push('source = ?'); values.push(updates.source); }
  if (updates.zip_key !== undefined) { fields.push('zip_key = ?'); values.push(updates.zip_key); }
  if (updates.zip_updated_at !== undefined) { fields.push('zip_updated_at = ?'); values.push(updates.zip_updated_at); }
  if (updates.enabled !== undefined) { fields.push('enabled = ?'); values.push(updates.enabled ? 1 : 0); }
  if (updates.premium_required !== undefined) { fields.push('premium_required = ?'); values.push(updates.premium_required ? 1 : 0); }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now')");
  values.push(slug);
  await env.DB.prepare(`UPDATE themes SET ${fields.join(', ')} WHERE slug = ?`).bind(...values).run();
}

/**
 * 删除主题
 */
export async function deleteTheme(env: Env, slug: string): Promise<void> {
  await env.DB.prepare('DELETE FROM themes WHERE slug = ?').bind(slug).run();
}

/**
 * 下载计数 +1
 */
export async function incrementDownloads(env: Env, slug: string): Promise<void> {
  await env.DB.prepare("UPDATE themes SET downloads = downloads + 1, updated_at = datetime('now') WHERE slug = ?")
    .bind(slug)
    .run();
}
