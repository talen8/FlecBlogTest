<script lang="ts" setup>
definePageMeta({});

const route = useRoute();
const {
  entity: tag,
  articles,
  total,
  currentPage,
  pageSize,
  handlePageChange,
} = await useEntityArticles('tag', route.params.slug as string);

useHead({
  title: () => (tag.value ? `标签:${tag.value.name}` : undefined),
});

useSeoMeta({
  title: () => (tag.value ? `标签 - ${tag.value.name}` : '标签'),
  description: () =>
    tag.value
      ? `浏览 ${tag.value.name} 标签下的 ${total.value} 篇文章，发现更多相关内容`
      : '浏览标签下的文章',
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
      v-if="tag"
      :articles="articles"
      :title="`标签 - ${tag.name}`"
      :total="total"
    />

    <!-- 分页 -->
    <UiPagination
      v-if="tag && total > pageSize"
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
