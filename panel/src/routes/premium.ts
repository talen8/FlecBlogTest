import { Hono } from 'hono';
import { Env, PremiumCode } from '../types';
import { verifyBuildSignature } from '../middleware/build-signature';

const apiRoutes = new Hono<{ Bindings: Env }>();
const adminRoutes = new Hono<{ Bindings: Env }>();

function formatShanghai(utcStr: string): string {
  const d = new Date(utcStr);
  d.setHours(d.getHours() + 8);
  return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, '');
}

function generateCode(days: number): string {
  const prefix = days === -1 ? 'L' : 'C';
  const chars = '0123456789ABCDEF';
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    let seg = '';
    for (let j = 0; j < 8; j++) seg += chars[Math.floor(Math.random() * chars.length)];
    segments.push(seg);
  }
  return `FLEC-${prefix}-${segments.join('-')}`;
}

apiRoutes.post('/activate', verifyBuildSignature, async (c) => {
  const body = await c.req.json();
  const code = body.code as string;
  const startTime = body.start_time as string | undefined;

  if (!code) return c.json({ error: '请输入激活码' }, 400);

  const row = await c.env.DB.prepare('SELECT * FROM premium_codes WHERE code = ?').bind(code).first<PremiumCode>();
  if (!row) return c.json({ error: '激活码不存在' }, 404);
  if (row.status === 'used') return c.json({ error: '该激活码已被使用' }, 400);

  const effectiveStart = startTime || new Date().toISOString();

  await c.env.DB.prepare("UPDATE premium_codes SET status = 'used', start_time = ? WHERE code = ?")
    .bind(effectiveStart, code).run();

  return c.json({ success: true, days: row.days, start_time: effectiveStart });
});

apiRoutes.post('/verify', verifyBuildSignature, async (c) => {
  const body = await c.req.json();
  const codes = body.codes as string[];

  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return c.json({ error: '请提供激活码列表' }, 400);
  }

  const limited = codes.slice(0, 100);
  const placeholders = limited.map(() => '?').join(',');
  const result = await c.env.DB.prepare(
    `SELECT code, days, status, start_time FROM premium_codes WHERE code IN (${placeholders})`
  ).bind(...limited).all<PremiumCode>();

  const codeMap = new Map(result.results.map(r => [r.code, r]));
  const records = limited.map(code => {
    const row = codeMap.get(code);
    if (!row) return { code, valid: false, reason: 'not_found' };
    if (row.status !== 'used') return { code, valid: false, reason: 'not_used' };
    return { code, valid: true, days: row.days, start_time: row.start_time };
  });

  return c.json({ records });
});

// ==================== /admin/premium（Panel 管理后台） ====================

// 批量生成激活码
adminRoutes.post('/codes', async (c) => {
  const body = await c.req.json();
  const days = Number(body.days);
  const count = Math.min(Number(body.count) || 1, 500);

  if (isNaN(days) || (days !== -1 && days <= 0)) {
    return c.json({ error: '请指定有效天数（-1=永久，>0=天数）' }, 400);
  }

  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = generateCode(days);
    await c.env.DB.prepare('INSERT INTO premium_codes (code, days) VALUES (?, ?)').bind(code, days).run();
    codes.push(code);
  }

  return c.json({ success: true, count: codes.length, codes });
});

// 获取激活码列表
adminRoutes.get('/codes', async (c) => {
  const status = c.req.query('status');
  let sql = 'SELECT * FROM premium_codes WHERE 1=1';
  const params: string[] = [];

  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';

  const result = await c.env.DB.prepare(sql).bind(...params).all<PremiumCode>();
  const codes = result.results.map(row => ({
    ...row,
    start_time: row.start_time ? formatShanghai(row.start_time) : null,
    created_at: row.created_at ? formatShanghai(row.created_at) : null,
  }));

  return c.json({ codes });
});

export { apiRoutes as premiumApiRoutes, adminRoutes as premiumAdminRoutes };
