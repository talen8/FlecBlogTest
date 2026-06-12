import {
  getArticlesForWeb,
  getArticleBySlug,
  getRandomArticleSlug as getRandomSlugApi,
} from '@/composables/api/article';
import { getCategoryBySlug } from '@/composables/api/category';
import { getTagBySlug } from '@/composables/api/tag';
import { countWords, estimateReadingTime } from '@/utils/markdown';
import type { Article, ArticleQuery } from '@@/types/article';
import type { Category } from '@@/types/category';
import type { Tag } from '@@/types/tag';

export function useArticles() {
  const articles = useState<Article[]>('articles', () => []);
  const total = useState<number>('articles-total', () => 0);
  const currentPage = useState<number>('articles-currentPage', () => 1);
  const pageSize = useState<number>('articles-pageSize', () => 10);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchArticles = async (query: ArticleQuery = {}, forceRefresh = false) => {
    if (query.page) currentPage.value = query.page;
    if (!forceRefresh && articles.value.length && !Object.keys(query).length) return;

    loading.value = true;
    error.value = null;
    try {
      const { list, total: resTotal } = await getArticlesForWeb({
        page: currentPage.value,
        page_size: pageSize.value,
        ...query,
      });
      articles.value = list || [];
      total.value = resTotal || 0;
    } catch (e) {
      console.error('获取文章列表失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      articles.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  async function useSSR(key: string, query?: ArticleQuery) {
    const { data } = await useAsyncData(key, () =>
      getArticlesForWeb({ page: 1, page_size: pageSize.value, ...query })
    );
    if (data.value) {
      articles.value = data.value.list || [];
      total.value = data.value.total || 0;
      currentPage.value = 1;
    }
    return { data };
  }

  async function getRandomArticleSlug(): Promise<string> {
    return getRandomSlugApi();
  }

  return {
    articles,
    total,
    currentPage,
    pageSize,
    loading,
    error,
    fetchArticles,
    useSSR,
    getRandomArticleSlug,
    setPageSize: (size: number) => {
      pageSize.value = size;
      currentPage.value = 1;
    },
    resetPage: () => (currentPage.value = 1),
  };
}

export async function useArticleDetail(slug: string) {
  const router = useRouter();
  const article = ref<Article | null>(null);
  const { setCurrentArticle } = useCurrentArticle();
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const { data: initialData, pending } = await useAsyncData(`post-${slug}`, async () => {
    try {
      const articleData = await getArticleBySlug(slug);
      setCurrentArticle(articleData);
      return articleData;
    } catch (err: unknown) {
      const e = err as Error & { response?: { status?: number } };
      if (e.response?.status === 404) {
        router.replace('/404');
      }
      return null;
    }
  });
  article.value = initialData.value ?? null;

  const wordCount = computed(() => {
    if (!article.value?.content) return 0;
    return countWords(article.value.content);
  });

  const readingTime = computed(() => {
    if (!article.value?.content) return 0;
    return estimateReadingTime(article.value.content, 300);
  });

  const commentCount = computed(() => {
    return article.value?.comment_count || 0;
  });

  async function refetch(newSlug: string) {
    loading.value = true;
    error.value = null;
    try {
      const articleData = await getArticleBySlug(newSlug);
      setCurrentArticle(articleData);
      article.value = articleData;
    } catch (err: unknown) {
      const e = err as Error & { response?: { status?: number } };
      error.value = e;
      if (e.response?.status === 404) {
        router.replace('/404');
      }
    } finally {
      loading.value = false;
    }
  }

  return {
    article,
    wordCount,
    readingTime,
    commentCount,
    loading: computed(() => pending.value || loading.value),
    error,
    refetch,
  };
}

type EntityType = 'category' | 'tag';

export async function useEntityArticles(type: EntityType, slug: string) {
  const router = useRouter();
  const route = useRoute();
  const entity = ref<Category | Tag | null>(null);
  const articles = ref<Article[]>([]);
  const total = ref(0);
  const currentPage = ref(1);
  const pageSize = ref(10);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchEntity = type === 'category' ? getCategoryBySlug : getTagBySlug;

  const { data: initialData, pending } = await useAsyncData(`${type}-${slug}`, async () => {
    try {
      const [entityData, articlesData] = await Promise.all([
        fetchEntity(slug),
        getArticlesForWeb({ [type]: slug, page: 1, page_size: pageSize.value }),
      ]);
      return { entity: entityData, articles: articlesData.list, total: articlesData.total };
    } catch (err: unknown) {
      const e = err as Error & { response?: { status?: number } };
      if (e.response?.status === 404) {
        router.replace('/404');
      }
      return null;
    }
  });

  if (initialData.value) {
    entity.value = initialData.value.entity;
    articles.value = initialData.value.articles;
    total.value = initialData.value.total;
    currentPage.value = 1;
  }

  function currentSlug() {
    return route.params.slug as string;
  }

  async function fetchArticlesForPage(page: number) {
    currentPage.value = page;
    loading.value = true;
    error.value = null;
    try {
      const articlesData = await getArticlesForWeb({
        [type]: currentSlug(),
        page,
        page_size: pageSize.value,
      });
      articles.value = articlesData.list;
      total.value = articlesData.total;
    } catch (err: unknown) {
      const e = err as Error & { response?: { status?: number } };
      error.value = e;
      if (e.response?.status === 404) {
        router.replace('/404');
      }
    } finally {
      loading.value = false;
    }
  }

  function handlePageChange(page: number) {
    fetchArticlesForPage(page);
    if (import.meta.client) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  return {
    entity,
    articles,
    total,
    currentPage,
    pageSize,
    loading: computed(() => pending.value || loading.value),
    error,
    fetchArticlesForPage,
    handlePageChange,
  };
}
