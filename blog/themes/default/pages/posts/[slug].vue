<script lang="ts" setup>
definePageMeta({
  typeHeader: 'post',
});

const route = useRoute();
const { clearCurrentArticle } = useCurrentArticle();
const { $tracker } = useNuxtApp();

const { article, refetch } = await useArticleDetail(route.params.slug as string);

useHead({
  title: () => article.value?.title,
});

useSeoMeta({
  title: () => article.value?.title,
  description: () => article.value?.summary || `${article.value?.title} - 阅读全文了解更多详情`,
  ogTitle: () => article.value?.title,
  ogDescription: () => article.value?.summary,
  ogImage: () => article.value?.cover,
  ogType: 'article',
  twitterTitle: () => article.value?.title,
  twitterDescription: () => article.value?.summary,
  twitterImage: () => article.value?.cover,
});

useSchemaOrg([
  defineArticle({
    headline: () => article.value?.title,
    description: () => article.value?.summary,
    image: () => article.value?.cover,
    datePublished: () => article.value?.publish_time,
    dateModified: () => article.value?.update_time,
  }),
]);

watch(
  () => route.params.slug,
  async newSlug => {
    await refetch(newSlug as string);
    if (article.value) {
      $tracker?.setArticleId(article.value.id);
      $tracker?.trackPageView(undefined, article.value.id);
      nextTick(() => {
        if (route.hash) {
          requestAnimationFrame(() => scrollToElement(route.hash, { block: 'start' }));
        }
      });
    } else {
      clearCurrentArticle();
      $tracker?.setArticleId(undefined);
    }
  }
);

watch(
  () => route.hash,
  hash => {
    if (hash) scrollToElement(hash, { block: 'start' });
  }
);

onUnmounted(() => {
  clearCurrentArticle();
  $tracker?.setArticleId(undefined);
});
</script>

<template>
  <div v-if="article" id="post">
    <FeaturesArticleAISummary v-if="article.ai_summary" :summary="article.ai_summary" />

    <FeaturesArticleOutdatedNotice v-if="article.is_outdated" />

    <FeaturesArticleContent :content="article.content!" />

    <FeaturesArticleCopyright :article="article" />

    <FeaturesArticleTags :article="article" />

    <FeaturesArticleNavigation :prev="article.prev" :next="article.next" />

    <LazyFeaturesCommentComments target-type="article" :target-key="article.slug!" />
  </div>
</template>

<style lang="scss" scoped>
#post {
  @extend .cardHover;
  align-self: flex-start;
  padding: 40px;
}

// 响应式设计
@media screen and (max-width: 1024px) {
  #post {
    padding: 30px;
  }
}

@media screen and (max-width: 768px) {
  #post {
    padding: 18px;
  }
}
</style>
