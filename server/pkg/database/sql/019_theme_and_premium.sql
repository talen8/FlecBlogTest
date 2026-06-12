-- 019: 创建主题实例配置表 + 迁移主题设置到 theme_instances.config + 清理 settings + 创建会员激活记录表

-- ============================================================
-- 第一步：建表 + 默认主题
-- ============================================================

CREATE TABLE IF NOT EXISTS theme_instances (
  slug             TEXT PRIMARY KEY,
  name             TEXT DEFAULT '',
  is_active        BOOLEAN DEFAULT FALSE,
  premium_required BOOLEAN DEFAULT FALSE,
  config           JSON,
  schema           JSON,
  menus            JSON DEFAULT '{}',
  version          TEXT,
  author           TEXT DEFAULT '',
  description      TEXT DEFAULT '',
  cover            TEXT DEFAULT '',
  license          TEXT DEFAULT '',
  repo             TEXT DEFAULT '',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO theme_instances (slug, name, is_active, config, schema, created_at, updated_at)
SELECT 'default', '默认主题', TRUE, '{}'::json, '{}'::json, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM theme_instances);

-- ============================================================
-- 第二步：迁移主题字段到 theme_instances.config
-- ============================================================

-- 待迁移的 key
CREATE TEMP TABLE IF NOT EXISTS migrate_keys (name TEXT PRIMARY KEY, type TEXT);
INSERT INTO migrate_keys VALUES
  ('basic.author_email','text'),('basic.author_desc','text'),('basic.author_photo','text'),
  ('blog.slogan','text'),('blog.background_image','text'),('blog.screenshot','text'),
  ('blog.announcement','text'),('blog.typing_texts','jsonb'),('blog.sidebar_social','jsonb'),
  ('blog.footer_social','jsonb'),('blog.footer_links','jsonb'),
  ('blog.about_describe','text'),('blog.about_describe_tips','text'),('blog.about_exhibition','text'),
  ('blog.about_profile','jsonb'),('blog.about_personality','text'),('blog.about_motto_main','jsonb'),
  ('blog.about_motto_sub','text'),('blog.about_socialize','jsonb'),('blog.about_creation','jsonb'),
  ('blog.about_versions','jsonb'),('blog.about_unions','jsonb'),('blog.about_story','text'),
  ('blog.font','text'),
  ('blog.moments_size','int'),('blog.message_content','text'),('blog.home_layout','text'),
  ('blog.donation_methods','jsonb'),('blog.theme_light_start','text'),('blog.theme_dark_start','text'),
  ('blog.wechat_qrcode','text'),('blog.wechat_name','text');

DO $$
DECLARE
  r RECORD; theme_slug TEXT; theme_display TEXT; cfg JSONB; v TEXT; c TEXT; n INT := 0; s INT := 0;
BEGIN
  SELECT slug, name INTO theme_slug, theme_display FROM theme_instances WHERE is_active LIMIT 1;
  IF theme_slug IS NULL THEN RAISE NOTICE '无激活主题，跳过'; RETURN; END IF;

  SELECT COALESCE(config::jsonb, '{}'::jsonb) INTO cfg FROM theme_instances WHERE slug = theme_slug;

  FOR r IN SELECT * FROM migrate_keys LOOP
    c := split_part(r.name, '.', 2);
    IF cfg ? c THEN s := s + 1; CONTINUE; END IF;

    SELECT value INTO v FROM settings WHERE key = r.name;
    CONTINUE WHEN v IS NULL OR v = '';

    BEGIN
      cfg := cfg || jsonb_build_object(c,
        CASE r.type
          WHEN 'int' THEN to_jsonb(v::INT)
          WHEN 'jsonb' THEN
            CASE
              -- 纯值数组 → 对象数组：[a,b] → [{value:a},{value:b}]
              WHEN r.name IN ('blog.about_motto_main', 'blog.typing_texts') THEN
                (SELECT COALESCE(jsonb_agg(jsonb_build_object('value', elem)), '[]'::jsonb)
                 FROM jsonb_array_elements_text(v::jsonb) AS elem)
              -- 图标名补 ri- 前缀
              WHEN r.name IN ('blog.sidebar_social', 'blog.footer_social') THEN
                (SELECT COALESCE(jsonb_agg(
                  CASE WHEN elem->>'icon' LIKE 'ri-%' THEN elem
                       ELSE jsonb_set(elem, '{icon}', to_jsonb('ri-' || COALESCE(elem->>'icon', '')))
                  END
                ), '[]'::jsonb)
                 FROM jsonb_array_elements(v::jsonb) AS elem)
              ELSE v::jsonb
            END
          ELSE
            CASE
              -- 时间格式 HH:mm → HH:mm:ss
              WHEN r.name IN ('blog.theme_light_start', 'blog.theme_dark_start') AND length(v) = 5 THEN
                to_jsonb(v || ':00')
              ELSE to_jsonb(v)
            END
        END
      );
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'skip %: %', r.name, SQLERRM;
    END;
  END LOOP;

  UPDATE theme_instances SET config = cfg::json, updated_at = NOW() WHERE slug = theme_slug;

  -- 扩大 upload_type 长度，支持长主题名（原 VARCHAR(20) 可能截断）
  ALTER TABLE files ALTER COLUMN upload_type TYPE VARCHAR(100);

  UPDATE files SET upload_type = theme_display
  WHERE file_url IN (
    SELECT cfg->>k FROM unnest(ARRAY['background_image','author_photo','screenshot','about_exhibition','wechat_qrcode']) k
    WHERE cfg ? k AND cfg->>k != ''
  );

  IF cfg ? 'donation_methods' THEN
    UPDATE files SET upload_type = theme_display
      WHERE file_url IN (SELECT elem->>'qrcode' FROM jsonb_array_elements(cfg->'donation_methods') elem WHERE elem->>'qrcode' != '');
  END IF;

  RAISE NOTICE '迁移 % 项，跳过 % 项', n, s;
END $$;

-- 删除已迁移的记录
DELETE FROM settings WHERE key IN (SELECT name FROM migrate_keys);

-- 先删旧唯一约束，避免后续去前缀 UPDATE 时 PG 逐行检查冲突
ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;

-- ============================================================
-- 第三步：清理——去前缀 + 合并 blog 到 basic + 改索引
-- ============================================================

UPDATE settings SET key = SUBSTRING(key FROM POSITION('.' IN key) + 1) WHERE "group" = 'basic' AND key LIKE 'basic.%';
UPDATE settings SET key = SUBSTRING(key FROM POSITION('.' IN key) + 1) WHERE "group" = 'blog' AND key LIKE 'blog.%';

-- 合并 blog 到 basic：同名 key 保留 basic 的值，删除 blog 的重复项
DELETE FROM settings WHERE "group" = 'blog' AND key IN (SELECT key FROM settings WHERE "group" = 'basic');
UPDATE settings SET "group" = 'basic' WHERE "group" = 'blog';

UPDATE settings SET key = SUBSTRING(key FROM POSITION('.' IN key) + 1) WHERE key LIKE '%.%' AND "group" != 'basic';

DROP INDEX IF EXISTS idx_settings_group_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_group_key ON settings ("group", key);

-- 清理临时表
DROP TABLE IF EXISTS migrate_keys;

-- ============================================================
-- 第四步：创建会员激活记录表
-- ============================================================

CREATE TABLE IF NOT EXISTS premium_activations (
    id         SERIAL PRIMARY KEY,
    code       TEXT NOT NULL,                          -- 激活码
    days       INTEGER NOT NULL,                       -- -1=永久, >0=天数
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),     -- 激活开始时间
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 第五步：将 menus 表数据迁移到 theme_instances.menus
-- ============================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'menus') THEN
    -- 确保 theme_slug 列存在
    ALTER TABLE menus ADD COLUMN IF NOT EXISTS theme_slug VARCHAR(100) NOT NULL DEFAULT 'default';

    -- 将 menus 表转换为嵌套 JSON 写入 theme_instances.menus
    WITH children AS (
      SELECT parent_id, jsonb_agg(
        jsonb_build_object(
          'id', id, 'title', title, 'url', COALESCE(url, ''),
          'icon', COALESCE(icon, ''), 'sort', sort,
          'is_enabled', is_enabled, 'children', '[]'::jsonb
        ) ORDER BY sort, id
      ) AS items
      FROM menus WHERE parent_id IS NOT NULL GROUP BY parent_id
    ),
    roots AS (
      SELECT m.theme_slug, m.type, jsonb_agg(
        jsonb_build_object(
          'id', m.id, 'title', m.title, 'url', COALESCE(m.url, ''),
          'icon', COALESCE(m.icon, ''), 'sort', m.sort,
          'is_enabled', m.is_enabled,
          'children', COALESCE(ch.items, '[]'::jsonb)
        ) ORDER BY m.sort, m.id
      ) AS items
      FROM menus m
      LEFT JOIN children ch ON ch.parent_id = m.id
      WHERE m.parent_id IS NULL
      GROUP BY m.theme_slug, m.type
    ),
    grouped AS (
      SELECT theme_slug, jsonb_object_agg(type, items ORDER BY type) AS menus_data
      FROM roots GROUP BY theme_slug
    )
    UPDATE theme_instances ti
    SET menus = COALESCE(g.menus_data, '{}'::jsonb)::json
    FROM grouped g WHERE ti.slug = g.theme_slug;

    RAISE NOTICE '菜单数据已从 menus 表迁移到 theme_instances.menus';
    DROP TABLE IF EXISTS menus CASCADE;
  ELSE
    RAISE NOTICE 'menus 表不存在，跳过数据迁移';
  END IF;
END $$;
