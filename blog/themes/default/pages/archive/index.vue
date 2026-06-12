<script lang="ts" setup>
definePageMeta({});

const PAGE_SIZE = 20;
const { articles, total, currentPage, fetchArticles, useSSR } = useArticles();

useSeoMeta({
  title: '归档',
  description: () => `浏览所有文章归档，共 ${total.value} 篇文章，按时间顺序查看历史文章`,
});

await useSSR('archive-articles', { page_size: PAGE_SIZE });

// 加载数据（总览页：按年分组显示）
const loadData = async (page: number = 1) => {
  await fetchArticles({
    page,
    page_size: PAGE_SIZE,
  });
};

// 处理分页变化
const handlePageChange = async (page: number) => {
  await loadData(page);
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};
</script>

<template>
  <div id="page">
    <FeaturesArchiveArticleList
      :articles="articles"
      :group-by-year="true"
      title="归档"
      :total="total"
    />

    <UiPagination
      v-if="total > PAGE_SIZE"
      :total="total"
      :current-page="currentPage"
      :page-size="PAGE_SIZE"
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
