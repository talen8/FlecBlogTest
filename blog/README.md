# Flec-Blog

> 基于 Nuxt 4 + Vue 3 的现代化博客前端应用

## 技术栈

- **框架**: [Nuxt 4](https://nuxt.com) - Vue.js 全栈框架
- **文章渲染**: markdown-it, Highlight.js, Mermaid
- **样式**: SCSS
- **SEO**: @nuxtjs/seo, Sitemap, Atom Feed
- **PWA**: @vite-pwa/nuxt
- **其他**: TypeScript, VueUse, dayjs, medium-zoom, APlayer

## 文件结构

```
blog/
├── app/                  # 应用主目录
│   ├── assets/           # 静态资源
│   ├── components/       # Vue 组件
│   ├── composables/      # 组合式函数
│   ├── layouts/          # 页面布局
│   ├── pages/            # 页面路由
│   ├── plugins/          # Nuxt 插件
│   ├── utils/            # 工具函数
│   └── app.vue           # 根组件
├── public/               # 公共文件
├── server/               # 服务端代码
│   ├── plugins/          # 服务端插件
│   └── routes/           # API 路由
├── types/                # TypeScript 类型定义
├── nuxt.config.ts        # Nuxt 配置
└── Dockerfile            # Docker 配置
```

详细文档请查看 [项目主 README](../README.md)。
