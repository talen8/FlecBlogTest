import { Hono } from 'hono';
import { Env } from '../types';
import * as db from '../services/db';
import { verifyBuildSignature } from '../middleware/build-signature';

const routes = new Hono<{ Bindings: Env }>();

routes.use('*', verifyBuildSignature);

routes.get('/versions', async (c) => {
  const versions = await db.getEnabledVersions(c.env, 10);
  return c.json(versions);
});

routes.get('/announcements', async (c) => {
  const announcements = await db.getPublicAnnouncements(c.env);
  return c.json(announcements);
});

routes.get('/themes', async (c) => {
  const category = c.req.query('category');
  const keyword = c.req.query('keyword');
  const themes = await db.getPublicThemes(c.env, category, keyword);
  const baseUrl = c.env.R2_PUBLIC_URL?.replace(/\/+$/, '') || '';
  const result = themes.map((t) => ({
    ...t,
    download_url: t.zip_key && baseUrl ? `${baseUrl}/api/themes/${t.slug}/download` : '',
  }));
  return c.json(result);
});

routes.get('/themes/:slug', async (c) => {
  const slug = c.req.param('slug');
  const theme = await db.getThemeBySlug(c.env, slug);
  if (!theme) return c.json({ error: '主题不存在' }, 404);
  const baseUrl = c.env.R2_PUBLIC_URL?.replace(/\/+$/, '') || '';
  return c.json({
    ...theme,
    download_url: theme.zip_key && baseUrl ? `${baseUrl}/api/themes/${slug}/download` : '',
  });
});

routes.get('/themes/preview/:slug', async (c) => {
  const slug = c.req.param('slug');
  const objects = await c.env.THEME_ASSETS!.list({ prefix: `previews/${slug}.` });
  if (objects.objects.length === 0) {
    return c.json({ error: '预览图不存在' }, 404);
  }

  const object = await c.env.THEME_ASSETS!.get(objects.objects[0].key);
  if (!object) return c.json({ error: '预览图不存在' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');
  headers.set('CDN-Cache-Control', 'public, max-age=86400');

  return new Response(object.body, { headers });
});

routes.get('/themes/:slug/download', async (c) => {
  const slug = c.req.param('slug');
  const theme = await db.getThemeBySlug(c.env, slug);
  if (!theme || !theme.enabled) return c.json({ error: '主题不存在' }, 404);
  if (!theme.zip_key) return c.json({ error: '主题 ZIP 尚未同步' }, 404);

  const object = await c.env.THEME_ASSETS!.get(theme.zip_key);
  if (!object) return c.json({ error: 'ZIP 文件不存在' }, 404);

  await db.incrementDownloads(c.env, slug);

  const headers = new Headers();
  headers.set('Content-Type', 'application/zip');
  headers.set('Content-Disposition', `attachment; filename="${slug}.zip"`);
  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(object.body, { headers });
});

routes.post('/themes/submit', async (c) => {
  const body = await c.req.parseBody();

  const getStr = (key: string) => ((body[key] as string) || '').trim();

  const name = getStr('name');
  const author = getStr('author');
  const repoUrl = getStr('repo_url');

  if (!name) return c.json({ error: '请填写主题名称' }, 400);
  if (!author) return c.json({ error: '请填写作者昵称' }, 400);
  if (!repoUrl) return c.json({ error: '请填写仓库地址' }, 400);

  let slug = getStr('slug').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!slug) {
    slug = name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  const existing = await db.getThemeBySlug(c.env, slug);
  if (existing) {
    slug = slug + '-' + Date.now().toString(36);
  }

  let previewUrl = '';
  const file = body['preview'] as File | undefined;
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
    author,
    description: getStr('description'),
    repo_url: repoUrl,
    preview_url: previewUrl,
    demo_url: getStr('demo_url'),
    category: getStr('category'),
    source: 'community',
    enabled: false,
    premium_required: false,
  });

  return c.json({ success: true, slug, preview_url: previewUrl || undefined });
});

export { routes as publicRoutes };
