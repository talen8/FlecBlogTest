import { Hono } from 'hono';
import { Env } from '../types';
import * as db from '../services/db';

const routes = new Hono<{ Bindings: Env }>();

function getStr(val: unknown): string {
  if (!val || val instanceof File) return '';
  return String(val).trim();
}

routes.get('/', async (c) => {
  const themes = await db.getAllThemes(c.env);
  return c.json(themes);
});

routes.post('/', async (c) => {
  const isMultipart = (c.req.header('content-type') || '').includes('multipart/form-data');
  const body = isMultipart ? await c.req.parseBody() : await c.req.json();

  const get = (key: string) => getStr(isMultipart ? body[key] : (body as any)[key]);

  const slug = get('slug');
  const name = get('name');
  const repoUrl = get('repo_url');

  if (!slug || !name || !repoUrl) {
    return c.json({ error: 'slug、name、repo_url 为必填项' }, 400);
  }

  const existing = await db.getThemeBySlug(c.env, slug);
  if (existing) return c.json({ error: 'slug 已存在' }, 409);

  let previewUrl = get('preview_url');
  const file = isMultipart ? (body['preview'] as File | undefined) : undefined;

  if (file) {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ error: '预览图仅支持 PNG/JPG/WebP/GIF 格式' }, 400);
    }
    if (file.size > 5 * 1024 * 1024) {
      return c.json({ error: '预览图大小不能超过 5MB' }, 400);
    }

    const ext = file.name.split('.').pop() || 'png';
    const key = `previews/${slug}.${ext}`;

    await c.env.THEME_ASSETS!.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    });

    if (c.env.R2_PUBLIC_URL) {
      previewUrl = `${c.env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
    } else {
      const url = new URL(c.req.url);
      previewUrl = `${url.origin}/api/themes/preview/${slug}`;
    }
  }

  await db.createTheme(c.env, {
    slug,
    name,
    author: get('author'),
    description: get('description'),
    repo_url: repoUrl,
    preview_url: previewUrl,
    demo_url: get('demo_url'),
    category: get('category'),
    source: get('source') || 'community',
    enabled: get('enabled') !== 'false',
    premium_required: get('premium_required') === 'true',
  });

  return c.json({ success: true, preview_url: previewUrl || undefined });
});

routes.put('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const existing = await db.getThemeBySlug(c.env, slug);
  if (!existing) return c.json({ error: '主题不存在' }, 404);

  const body = await c.req.json();
  await db.updateTheme(c.env, slug, body);
  return c.json({ success: true });
});

routes.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const theme = await db.getThemeBySlug(c.env, slug);
  if (!theme) return c.json({ error: '主题不存在' }, 404);
  return c.json(theme);
});

routes.get('/:slug/check', async (c) => {
  const slug = c.req.param('slug');
  const theme = await db.getThemeBySlug(c.env, slug);
  if (!theme) return c.json({ error: '主题不存在' }, 404);

  const match = theme.repo_url?.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!match) {
    return c.json({ ok: false, error: '仅支持 GitHub 仓库' });
  }

  const [, owner, repo] = match;
  const branches = ['main', 'master'];
  let found = false;
  let version = '';

  for (const branch of branches) {
    try {
      const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/theme.config.json`;
      const res = await fetch(url);
      if (res.ok) {
        const config = await res.json() as any;
        version = config?.version || '';
        found = true;
        break;
      }
    } catch { /* try next branch */ }
  }

  return c.json({ ok: found, version, repo: `${owner}/${repo}` });
});

routes.delete('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const existing = await db.getThemeBySlug(c.env, slug);
  if (!existing) return c.json({ error: '主题不存在' }, 404);

  await db.deleteTheme(c.env, slug);
  return c.json({ success: true });
});

routes.post('/:slug/preview', async (c) => {
  const slug = c.req.param('slug');
  const existing = await db.getThemeBySlug(c.env, slug);
  if (!existing) return c.json({ error: '主题不存在' }, 404);

  const body = await c.req.parseBody();
  const file = body['file'] as File | undefined;
  if (!file) return c.json({ error: '请上传图片文件' }, 400);

  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: '仅支持 PNG/JPG/WebP/GIF 格式' }, 400);
  }
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: '文件大小不能超过 5MB' }, 400);
  }

  const ext = file.name.split('.').pop() || 'png';
  const key = `previews/${slug}.${ext}`;

  await c.env.THEME_ASSETS!.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  let previewUrl: string;
  if (c.env.R2_PUBLIC_URL) {
    previewUrl = `${c.env.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`;
  } else {
    const url = new URL(c.req.url);
    previewUrl = `${url.origin}/api/themes/preview/${slug}`;
  }
  await db.updateTheme(c.env, slug, { preview_url: previewUrl });

  return c.json({ success: true, preview_url: previewUrl });
});

export { routes as themeRoutes };
