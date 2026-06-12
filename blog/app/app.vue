<script setup lang="ts">
import { getCategories } from '@/composables/api/category';
import { getTags } from '@/composables/api/tag';
import { getSiteStats } from '@/composables/api/stats';
import { getSettingGroup } from '@/composables/api/sysconfig';
import { getActiveThemeSchema } from '@/composables/api/theme';

// 全局数据
const { basicConfig, oauthConfig, uploadConfig } = useSysConfig();
const { menus } = useMenus();
const { categories, total: categoriesTotal } = useCategories();
const { tags, total: tagsTotal } = useTags();
const { siteStats } = useStats();
const { theme } = useTheme();

const { data: globalData } = await useAsyncData('global-data', async () => {
  const [basicData, oauthData, uploadData, categoriesData, tagsData, statsData, themeData] =
    await Promise.all([
      getSettingGroup('basic'),
      getSettingGroup('oauth'),
      getSettingGroup('upload'),
      getCategories(),
      getTags(),
      getSiteStats(),
      getActiveThemeSchema(),
    ]);

  return {
    basicConfig: basicData,
    oauthConfig: oauthData,
    uploadConfig: uploadData,
    menus: themeData.menus || {},
    categories: categoriesData.list,
    categoriesTotal: categoriesData.total,
    tags: tagsData.list,
    tagsTotal: tagsData.total,
    stats: statsData,
    theme: themeData,
  };
});

// 初始化全局数据
watchEffect(() => {
  if (globalData.value) {
    basicConfig.value = globalData.value.basicConfig;
    oauthConfig.value = globalData.value.oauthConfig;
    uploadConfig.value = globalData.value.uploadConfig;
    menus.value = globalData.value.menus;
    categories.value = globalData.value.categories;
    tags.value = globalData.value.tags;
    siteStats.value = globalData.value.stats;
    if (globalData.value.categoriesTotal !== undefined) {
      categoriesTotal.value = globalData.value.categoriesTotal;
    }
    if (globalData.value.tagsTotal !== undefined) {
      tagsTotal.value = globalData.value.tagsTotal;
    }
    if (globalData.value.theme) {
      theme.value = {
        slug: globalData.value.theme.slug,
        name: globalData.value.theme.name || globalData.value.theme.slug,
        schema: globalData.value.theme.schema,
        config: globalData.value.theme.config ?? {},
        loaded: true,
      };
    }
    initMarkdownRenderer();
  }
});

// 刷新时恢复滚动位置
onMounted(() => {
  const key = 'scroll-y';
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  if (nav?.type === 'reload') {
    const y = +(sessionStorage.getItem(key) || 0);
    if (y > 0) setTimeout(() => window.scrollTo(0, y), 100);
  }
  let t: ReturnType<typeof setTimeout>;
  const save = () => sessionStorage.setItem(key, '' + window.scrollY);
  window.addEventListener(
    'scroll',
    () => {
      clearTimeout(t);
      t = setTimeout(save, 200);
    },
    { passive: true }
  );
  window.addEventListener('pagehide', save);
});

// SEO Meta
useSeoMeta({
  description: () => basicConfig.value.description,
  keywords: () => basicConfig.value.keywords,
  author: () => basicConfig.value.author,
  // Open Graph
  ogTitle: () => basicConfig.value.title,
  ogDescription: () => basicConfig.value.description,
  ogImage: () => basicConfig.value.favicon,
  ogType: 'website',
  ogSiteName: () => basicConfig.value.title,
  // Twitter Card
  twitterCard: 'summary_large_image',
  twitterTitle: () => basicConfig.value.title,
  twitterDescription: () => basicConfig.value.description,
  twitterImage: () => basicConfig.value.favicon,
});

// 页面标题模板和 favicon
const route = useRoute();
const siteTitle = computed(() => basicConfig.value.title);

useHead({
  titleTemplate: (title): string | null => {
    // 首页特殊处理：显示"网站标题 - 网站副标题"
    if (route.path === '/') {
      const subtitle = basicConfig.value.subtitle;
      return subtitle ? `${siteTitle.value} - ${subtitle}` : siteTitle.value || null;
    }

    // 其他页面：显示"页面标题 | 网站标题"
    const pageTitle = title || (route.meta.title as string);
    if (pageTitle) return `${pageTitle} | ${siteTitle.value}`;
    return siteTitle.value || null;
  },
  link: [
    { rel: 'icon', href: basicConfig.value.favicon || '/favicon.ico' },
    // PWA Manifest
    { rel: 'manifest', href: '/manifest.json' },
    // RSS/Atom 订阅
    {
      rel: 'alternate',
      type: 'application/rss+xml',
      title: `${basicConfig.value.title} - RSS 2.0 Feed`,
      href: '/rss.xml',
    },
    {
      rel: 'alternate',
      type: 'application/atom+xml',
      title: `${basicConfig.value.title} - Atom Feed`,
      href: '/atom.xml',
    },
  ],
  meta: computed(() => [
    { name: 'description', content: basicConfig.value.description },
    { name: 'keywords', content: basicConfig.value.keywords },
    { name: 'author', content: basicConfig.value.author },
    // PWA 主题色
    { name: 'theme-color', content: '#f7f7f7' },
    { name: 'mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
  ]),
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: basicConfig.value.title,
        description: basicConfig.value.description,
      }),
    },
  ],
});
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
