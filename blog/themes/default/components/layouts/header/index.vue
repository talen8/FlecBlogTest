<script lang="ts" setup>
import HomeHeader from './HomeHeader.vue';
import PostHeader from './PostHeader.vue';

const route = useRoute();
const type = computed(() => route.meta.typeHeader as string | undefined);
</script>

<template>
  <HomeHeader v-if="type === 'home'" />
  <PostHeader v-else-if="type === 'post'" />
</template>
