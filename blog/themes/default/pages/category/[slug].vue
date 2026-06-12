<script lang="ts" setup>
definePageMeta({});

const route = useRoute();
const {
  entity: category,
  articles,
  total,
  currentPage,
  pageSize,
  handlePageChange,
} = await useEntityArticles('category', route.params.slug as string);

useHead({
  title: () => (category.value ? `分类:${category.value.name}` : undefined),
});

useSeoMeta({
  title: () => (category.value ? `分类 - ${category.value.name}` : '分类'),
  description: () =>
    category.value
      ? `浏览 ${category.value.name} 分类下的 ${total.value} 篇文章，探索更多相关内容`
      : '浏览分类下的文章',
});

watch(
  () => route.params.slug,
  () => {
    currentPage.value = 1;
    handlePageChange(1);
  }
);
</script>

<template>
  <div id="page">
    <FeaturesArchiveArticleList
      v-if="category"
      :articles="articles"
      :title="`分类 - ${category.name}`"
      :total="total"
    />

    <!-- 分页 -->
    <UiPagination
      v-if="category && total > pageSize"
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
