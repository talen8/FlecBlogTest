import { getMoments } from '@/composables/api/moment';
import type { Moment } from '@@/types/moment';

export function useMoments() {
  const moments = useState<Moment[]>('moments', () => []);
  const total = useState<number>('moments-total', () => 0);
  const currentPage = useState<number>('moments-currentPage', () => 1);
  const pageSize = useState<number>('moments-pageSize', () => 30);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchMoments = async (page: number = 1, forceRefresh = false) => {
    if (page) currentPage.value = page;
    if (!forceRefresh && moments.value.length) return;

    loading.value = true;
    error.value = null;
    try {
      const {
        list,
        total: resTotal,
        page: resPage,
        page_size: resPageSize,
      } = await getMoments({
        page: currentPage.value,
        page_size: pageSize.value,
      });
      moments.value = list || [];
      total.value = resTotal || 0;
      currentPage.value = resPage || 1;
      pageSize.value = resPageSize || 30;
    } catch (e) {
      console.error('获取动态列表失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      moments.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  async function useSSR(key: string, pageSizeOverride?: number) {
    const { data } = await useAsyncData(key, () =>
      getMoments({ page: 1, page_size: pageSizeOverride || pageSize.value })
    );
    if (data.value) {
      moments.value = data.value.list || [];
      total.value = data.value.total || 0;
      pageSize.value = data.value.page_size || pageSizeOverride || pageSize.value;
      currentPage.value = 1;
    }
    return { data };
  }

  /**
   * 供小组件/侧边栏使用，不会污染全局 moments state
   */
  async function fetchWidgetMoments(pageSize: number): Promise<Moment[]> {
    try {
      const { list } = await getMoments({ page: 1, page_size: pageSize });
      return list || [];
    } catch {
      return [];
    }
  }

  /**
   * 小组件 SSR 数据获取（不污染全局 state）
   */
  async function useWidgetSSR(key: string, pageSize: number) {
    return useAsyncData(key, () => fetchWidgetMoments(pageSize));
  }

  return {
    moments,
    total,
    currentPage,
    pageSize,
    loading,
    error,
    fetchMoments,
    useSSR,
    fetchWidgetMoments,
    useWidgetSSR,
  };
}
