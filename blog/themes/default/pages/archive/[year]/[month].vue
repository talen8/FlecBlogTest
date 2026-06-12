<script lang="ts" setup>
definePageMeta({});

const route = useRoute();
const { articles, total, currentPage, pageSize, fetchArticles, useSSR } = useArticles();

useHead({
  title: () => `${route.params.year}${route.params.month}归档`,
});

useSeoMeta({
  title: () => `${route.params.year}年${route.params.month}月归档`,
  description: () =>
    `浏览 ${route.params.year}年${route.params.month}月发布的所有文章，共 ${total.value} 篇`,
});

const listTitle = computed(() => `归档 - ${route.params.year}年${route.params.month}月`);

await useSSR(`archive-${route.params.year}-${route.params.month}`, {
  year: route.params.year as string,
  month: route.params.month as string,
});

// 加载数据（月份详情页：按年月筛选）
const loadData = async (page: number = 1) => {
  await fetchArticles({
    year: route.params.year as string,
    month: route.params.month as string,
    page,
  });
};

// 处理分页变化
const handlePageChange = async (page: number) => {
  await loadData(page);
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

// 监听路由参数变化（切换不同月份时重新加载）
watch(
  () => [route.params.year, route.params.month],
  () => {
    loadData(1);
  },
  { deep: true }
);
</script>

<template>
  <div id="page">
    <FeaturesArchiveArticleList
      :articles="articles"
      :group-by-year="false"
      :title="listTitle"
      :total="total"
    />

    <UiPagination
      v-if="total > pageSize"
      :total="total"
      :current-page="currentPage"
      :page-size="pageSize"
      @change="handlePageChange"
    />
  </div>
</template>

<style lang="scss" scoped>
#page {
  @extend .cardHover;
  align-self: flex-start;
  padding: 40px;
}

// 响应式设计
@media screen and (max-width: 1024px) {
  #page {
    padding: 30px;
  }
}

@media screen and (max-width: 768px) {
  #page {
    padding: 18px;
  }
}
</style>
