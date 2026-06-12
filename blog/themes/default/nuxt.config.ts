/**
 * 默认主题的 Nuxt Layer 配置
 * 作为 Nuxt Layer 被主应用通过 extends 引用
 */
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  routeRules: {
    '/': { isr: false },
    '/archive/**': { isr: false },
    '/category/**': { isr: false },
    '/tag/**': { isr: false },
    '/posts/**': { isr: false },
    '/profile': { sitemap: false },
    '/notifications': { sitemap: false },
    '/feedback': { sitemap: false },
    '/subscribe': { sitemap: false },
    '/oauth/**': { sitemap: false },
  },

  // 主题 CSS 文件
  css: [
    new URL('./assets/css/color.css', import.meta.url).pathname,
    new URL('./assets/css/global.scss', import.meta.url).pathname,
  ],

  // SCSS 全局注入 mixins + prose
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: [
            `@use '${cssAbs('_mixins.scss')}' as *;`,
            `@use '${cssAbs('_prose.scss')}' as *;`,
            '',
          ].join('\n'),
        },
      },
    },
  },
});

/** 获取主题 assets/css 下文件的绝对路径（SCSS @use 需要正斜杠） */
function cssAbs(file: string): string {
  return new URL(`./assets/css/${file}`, import.meta.url).pathname.replace(/\\/g, '/');
}
