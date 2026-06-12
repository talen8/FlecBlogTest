import { Env } from '../types';
import { getSetting } from './db';

interface GitHubApiRelease {
  tag_name: string;
  published_at: string;
  body: string;
}

export async function syncGitHubReleases(env: Env): Promise<{ success: boolean; count: number; error?: string }> {
  const githubRepo = await getSetting(env, 'github_repo');
  if (!githubRepo) {
    return { success: false, count: 0, error: '请先配置 GitHub 仓库' };
  }

  const githubToken = await getSetting(env, 'github_token');

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'FlecPanel/1.0',
    };

    if (githubToken) {
      headers['Authorization'] = `Bearer ${githubToken}`;
    }

    const res = await fetch(`https://api.github.com/repos/${githubRepo}/releases?per_page=10`, {
      headers,
    });

    if (!res.ok) {
      if (res.status === 403) {
        return { success: false, count: 0, error: 'API 速率限制，请配置 GitHub Token' };
      }
      return { success: false, count: 0, error: `GitHub API 错误: ${res.status}` };
    }

    const releases = await res.json() as GitHubApiRelease[];
    let count = 0;

    for (const release of releases) {
      let version = release.tag_name;
      if (!version.startsWith('v')) continue;

      version = version.substring(1);

      // 跳过非正式版本（alpha、beta、rc、pre 等）
      // TODO: 测试完成后恢复此过滤
      // const prereleasePattern = /-(alpha|beta|rc|pre|dev|snapshot|nightly)(\.\d+)?$/i;
      // if (prereleasePattern.test(version)) continue;
      const date = release.published_at.split('T')[0];
      const changes = parseReleaseBody(release.body || '');

      const result = await env.DB.prepare(
        'INSERT OR IGNORE INTO versions (version, date, changes, enabled) VALUES (?, ?, ?, 0)'
      )
        .bind(version, date, changes)
        .run();

      if (result.meta?.changes && result.meta.changes > 0) {
        count++;
      }
    }

    return { success: true, count };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, count: 0, error: message };
  }
}

export async function autoEnablePendingVersions(env: Env): Promise<number> {
  const result = await env.DB.prepare(
    "UPDATE versions SET enabled = 1 WHERE enabled = 0 AND datetime(created_at) <= datetime('now', '-6 hours')"
  ).run();

  return result.meta?.changes || 0;
}

export async function syncThemeVersions(env: Env): Promise<{ success: boolean; count: number; errors: string[] }> {
  const themes = await env.DB.prepare('SELECT slug, repo_url FROM themes WHERE repo_url != ""').all<{ slug: string; repo_url: string }>();
  let count = 0;
  const errors: string[] = [];

  for (const theme of themes.results) {
    try {
      const match = theme.repo_url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (!match) continue;

      const [, owner, repo] = match;
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/main/theme.config.json`;
      const res = await fetch(url);

      // 部分仓库默认分支不是 main
      let config: { version?: string } | null = null;
      if (res.ok) {
        config = await res.json();
      } else {
        const fallback = `https://raw.githubusercontent.com/${owner}/${repo}/master/theme.config.json`;
        const fallbackRes = await fetch(fallback);
        if (fallbackRes.ok) {
          config = await fallbackRes.json();
        }
      }

      if (config?.version) {
        await env.DB.prepare("UPDATE themes SET version = ?, updated_at = datetime('now') WHERE slug = ?")
          .bind(config.version, theme.slug)
          .run();
        count++;
      }
    } catch (e) {
      errors.push(`${theme.slug}: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  }

  return { success: true, count, errors };
}

/**
 * 同步主题 ZIP 到 R2
 * 从 GitHub 下载仓库 archive 原样存入 R2，更新 D1 的 zip_key 和 zip_updated_at
 */
export async function syncThemeZips(env: Env): Promise<{ success: boolean; count: number; errors: string[] }> {
  if (!env.THEME_ASSETS) {
    return { success: false, count: 0, errors: ['R2 未配置'] };
  }

  const themes = await env.DB.prepare(
    "SELECT slug, repo_url FROM themes WHERE enabled = 1 AND repo_url != ''"
  ).all<{ slug: string; repo_url: string }>();

  let count = 0;
  const errors: string[] = [];
  const githubToken = await getSetting(env, 'github_token');

  for (const theme of themes.results) {
    try {
      const match = theme.repo_url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
      if (!match) continue;

      const [, owner, repo] = match;
      const headers: Record<string, string> = {
        'User-Agent': 'FlecPanel/1.0',
      };
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      // 尝试 main 分支，失败则尝试 master
      let archiveUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/main`;
      let res = await fetch(archiveUrl, { redirect: 'follow', headers });

      if (!res.ok) {
        archiveUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/master`;
        res = await fetch(archiveUrl, { redirect: 'follow', headers });
      }

      if (!res.ok) {
        errors.push(`${theme.slug}: 下载失败 (${res.status})`);
        continue;
      }

      const zipData = await res.arrayBuffer();
      const r2Key = `themes/${theme.slug}.zip`;

      await env.THEME_ASSETS.put(r2Key, zipData, {
        httpMetadata: { contentType: 'application/zip' },
      });

      await env.DB.prepare(
        "UPDATE themes SET zip_key = ?, zip_updated_at = datetime('now'), updated_at = datetime('now') WHERE slug = ?"
      )
        .bind(r2Key, theme.slug)
        .run();

      count++;
    } catch (e) {
      errors.push(`${theme.slug}: ${e instanceof Error ? e.message : '未知错误'}`);
    }
  }

  return { success: true, count, errors };
}

function parseReleaseBody(body: string): string {
  const lines: string[] = [];

  const patterns: Record<string, RegExp> = {
    feat: /### ?(?:✨|New Features?|Features?)\n([\s\S]*?)(?=\n###|$)/i,
    fix: /### ?(?:🐛|Bug Fixes?|Fixes?)\n([\s\S]*?)(?=\n###|$)/i,
    refactor: /### ?(?:♻️|Refactors?|Code Changes?)\n([\s\S]*?)(?=\n###|$)/i,
    docs: /### ?(?:📝|Documentation|Docs?)\n([\s\S]*?)(?=\n###|$)/i,
    style: /### ?(?:💄|Styles?)\n([\s\S]*?)(?=\n###|$)/i,
    test: /### ?(?:✅|Tests?)\n([\s\S]*?)(?=\n###|$)/i,
    chore: /### ?(?:🔧|Chores?|Maintenance)\n([\s\S]*?)(?=\n###|$)/i,
  };

  const labels: Record<string, string> = {
    feat: '新功能',
    fix: '修复',
    refactor: '重构',
    docs: '文档',
    style: '样式',
    test: '测试',
    chore: '杂项',
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = body.match(pattern);
    if (match) {
      const items = match[1]
        .split('\n')
        .map(line => line.replace(/^[-*]\s*/, '').trim())
        .filter(line => line.length > 0);
      for (const item of items) {
        lines.push(`[${labels[key]}] ${item}`);
      }
    }
  }

  return lines.join('\n');
}
