import type { Context, Next } from 'hono';

export function verifyApiKey(providedKey: string, expectedKey: string): boolean {
  return !!providedKey && !!expectedKey && providedKey === expectedKey;
}

export async function verifyBuildSignature(c: Context, next: Next) {
  const providedKey = c.req.header('X-API-Key');
  const expectedKey = c.env.PANEL_API_KEY;

  if (verifyApiKey(providedKey || '', expectedKey || '')) {
    await next();
    return;
  }

  return c.json({ error: '此功能需要官方构建版本' }, 403);
}
