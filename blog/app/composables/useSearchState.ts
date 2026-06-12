import { searchArticles } from '@/composables/api/article';
import type { Article } from '@@/types/article';

export function useSearchState() {
  const keyword = ref('');
  const articles = ref<Article[]>([]);
  const total = ref(0);
  const page = ref(1);
  const pageSize = 5;
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const totalPages = computed(() => Math.ceil(total.value / pageSize));
  const hasSearched = computed(() => keyword.value.trim().length > 0);

  function highlight(text: string): string {
    const kw = keyword.value.trim();
    if (!kw || !text) return text;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  function reset() {
    keyword.value = '';
    articles.value = [];
    total.value = 0;
    page.value = 1;
  }

  async function search(newPage = 1) {
    const searchTerm = keyword.value.trim();
    if (!searchTerm) {
      articles.value = [];
      total.value = 0;
      return;
    }

    loading.value = true;
    error.value = null;
    page.value = newPage;

    try {
      const data = await searchArticles(searchTerm, { page: newPage, page_size: pageSize });
      articles.value = data.list;
      total.value = data.total;
    } catch (e) {
      console.error('搜索失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      articles.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  }

  const debouncedSearch = useDebounceFn(() => search(1), 500);

  function onKeywordChange() {
    page.value = 1;
    debouncedSearch();
  }

  function prevPage() {
    if (page.value > 1) search(page.value - 1);
  }

  function nextPage() {
    if (page.value < totalPages.value) search(page.value + 1);
  }

  return {
    keyword,
    articles,
    total,
    page,
    pageSize,
    loading,
    error,
    totalPages,
    hasSearched,
    highlight,
    reset,
    search,
    debouncedSearch,
    onKeywordChange,
    prevPage,
    nextPage,
  };
}
