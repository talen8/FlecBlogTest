export default defineEventHandler(async event => {
  try {
    const config = useRuntimeConfig();
    const apiUrl = (config.public.apiUrl as string).replace(/\/+$/, '');
    const res = await $fetch<{ code: number; data: Record<string, string> }>(
      `${apiUrl}/settings/basic`
    );
    const cfg = res.code === 0 ? res.data : {};

    const manifest = {
      name: cfg.title || 'FlecBlog',
      short_name: cfg.title?.substring(0, 12) || 'Flec',
      description: cfg.description || '个人博客',
      theme_color: '#f7f7f7',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [
        {
          src: cfg.favicon || '/favicon.ico',
          sizes: '192x192',
          type: 'image/png',
        },
        {
          src: cfg.favicon || '/favicon.ico',
          sizes: '512x512',
          type: 'image/png',
        },
      ],
    };

    setHeader(event, 'Content-Type', 'application/manifest+json');
    return manifest;
  } catch {
    return {
      name: 'FlecBlog',
      short_name: 'Flec',
      theme_color: '#f7f7f7',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/',
      icons: [{ src: '/favicon.ico', sizes: '192x192', type: 'image/png' }],
    };
  }
});
