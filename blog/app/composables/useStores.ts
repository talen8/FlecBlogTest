import { getComments, createComment, deleteComment } from '@/composables/api/comment';
import { getNotifications, markAsRead, markAllAsRead } from '@/composables/api/notification';
import { getCategories } from '@/composables/api/category';
import { getTags } from '@/composables/api/tag';
import { getArticlesForWeb } from '@/composables/api/article';
import { getSiteStats, getArchiveStats } from '@/composables/api/stats';
import type { Article } from '@@/types/article';
import type { Category } from '@@/types/category';
import type { Comment, CreateCommentParams, CommentTargetType } from '@@/types/comment';
import type { Menu } from '@@/types/theme';
import type { Notification, GetNotificationsParams } from '@@/types/notification';
import type { ArchiveItem, SiteStats } from '@@/types/stats';
import type { Tag } from '@@/types/tag';

// ============================================================
// 文章状态
// ============================================================

export function useCurrentArticle() {
  const currentArticle = useState<Article | null>('currentArticle', () => null);

  return {
    currentArticle,
    setCurrentArticle: (article: Article | null) => (currentArticle.value = article),
    clearCurrentArticle: () => (currentArticle.value = null),
  };
}

// ============================================================
// 分类
// ============================================================

export function useCategories() {
  const categories = useState<Category[]>('categories', () => []);
  const total = useState<number>('categories-total', () => 0);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchCategories = async (forceRefresh = false) => {
    if (!forceRefresh && categories.value.length) return;

    loading.value = true;
    error.value = null;
    try {
      const { list, total: resTotal } = await getCategories();
      categories.value = list || [];
      total.value = resTotal || 0;
    } catch (e) {
      console.error('获取分类列表失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      categories.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  return { categories, total, loading, error, fetchCategories };
}

// ============================================================
// 标签
// ============================================================

export function useTags() {
  const tags = useState<Tag[]>('tags', () => []);
  const total = useState<number>('tags-total', () => 0);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchTags = async (forceRefresh = false) => {
    if (!forceRefresh && tags.value.length) return;

    loading.value = true;
    error.value = null;
    try {
      const { list, total: resTotal } = await getTags();
      tags.value = list || [];
      total.value = resTotal || 0;
    } catch (e) {
      console.error('获取标签列表失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      tags.value = [];
      total.value = 0;
    } finally {
      loading.value = false;
    }
  };

  return { tags, total, loading, error, fetchTags };
}

// ============================================================
// 菜单
// ============================================================

export function useMenus() {
  const menus = useState<Record<string, Menu[]>>('menus', () => ({}));

  const filterByKey = (key: string) => (menus.value[key] || []).sort((a, b) => a.sort - b.sort);

  return {
    menus,
    filterByKey,
  };
}

// ============================================================
// 评论
// ============================================================

export function useComments() {
  const comments = useState<Comment[]>('comments', () => []);
  const currentTargetType = useState<CommentTargetType | null>('comments-targetType', () => null);
  const currentTargetKey = useState<string | number | null>('comments-targetKey', () => null);
  const { articles } = useArticles();
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchComments = async (targetType: CommentTargetType, targetKey: string | number) => {
    if (!targetType || !targetKey) return;

    currentTargetType.value = targetType;
    currentTargetKey.value = targetKey;

    loading.value = true;
    error.value = null;
    try {
      const data = await getComments({
        target_type: targetType,
        target_key: targetKey,
      });
      comments.value = data.list || [];
    } catch (e) {
      console.error('获取评论失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      comments.value = [];
    } finally {
      loading.value = false;
    }
  };

  const addComment = async (params: CreateCommentParams) => {
    const newComment = await createComment(params);

    if (!params.parent_id) {
      comments.value.unshift(newComment);
    } else {
      const addReplyToComment = (commentList: Comment[]): boolean => {
        for (const comment of commentList) {
          if (comment.id === params.parent_id) {
            if (!comment.replies) comment.replies = [];
            comment.replies.push(newComment);
            return true;
          }
          if (comment.replies?.length && addReplyToComment(comment.replies)) return true;
        }
        return false;
      };
      addReplyToComment(comments.value);
    }

    if (params.target_type === 'article') {
      const article = articles.value.find(a => a.slug === params.target_key);
      if (article) {
        article.comment_count = (article.comment_count || 0) + 1;
      }
      refreshNuxtData('articles-list');
    }

    return newComment;
  };

  const removeComment = async (commentId: number) => {
    await deleteComment(commentId);

    const removeFromList = (commentList: Comment[]): boolean => {
      const index = commentList.findIndex(c => c.id === commentId);
      if (index !== -1) {
        commentList.splice(index, 1);
        return true;
      }
      for (const comment of commentList) {
        if (comment.replies?.length && removeFromList(comment.replies)) return true;
      }
      return false;
    };
    removeFromList(comments.value);

    if (currentTargetType.value === 'article' && currentTargetKey.value) {
      const article = articles.value.find(a => a.slug === currentTargetKey.value);
      if (article) {
        article.comment_count = Math.max(0, (article.comment_count || 0) - 1);
      }
      refreshNuxtData('articles-list');
    }
  };

  return {
    comments,
    loading,
    error,
    fetchComments,
    addComment,
    removeComment,
    resetComments: () => {
      comments.value = [];
      currentTargetType.value = null;
      currentTargetKey.value = null;
    },
    flattenComments,
  };
}

// ============================================================
// 通知
// ============================================================

export function useNotifications() {
  const notifications = useState<Notification[]>('notifications', () => []);
  const total = useState<number>('notifications-total', () => 0);
  const currentPage = useState<number>('notifications-currentPage', () => 1);
  const pageSize = useState<number>('notifications-pageSize', () => 10);
  const unreadCount = useState<number>('notifications-unreadCount', () => 0);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  const fetchNotifications = async (params?: Partial<GetNotificationsParams>) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await getNotifications({
        page: params?.page ?? currentPage.value,
        page_size: params?.page_size ?? pageSize.value,
      });
      notifications.value = response.list || [];
      total.value = response.total || 0;
      unreadCount.value = response.unread_count || 0;
      if (params?.page) {
        currentPage.value = params.page;
      }
    } catch (e) {
      console.error('获取通知列表失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      notifications.value = [];
      total.value = 0;
      unreadCount.value = 0;
    } finally {
      loading.value = false;
    }
  };

  const markNotificationAsRead = async (id: number) => {
    try {
      await markAsRead(id);
      const notification = notifications.value.find(n => n.id === id);
      if (notification?.is_read === false) {
        notification.is_read = true;
        notification.read_at = new Date().toISOString();
        unreadCount.value = Math.max(0, unreadCount.value - 1);
      }
    } catch (error) {
      console.error('标记通知已读失败:', error);
      throw error;
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      await markAllAsRead();
      notifications.value.forEach(n => {
        n.is_read = true;
        n.read_at = new Date().toISOString();
      });
      unreadCount.value = 0;
    } catch (error) {
      console.error('标记所有通知已读失败:', error);
      throw error;
    }
  };

  // 轮询逻辑
  let _pollTimer: ReturnType<typeof setInterval> | null = null;

  const startPolling = (intervalMs = 30000) => {
    stopPolling();
    _pollTimer = setInterval(() => {
      fetchNotifications({ page: 1, page_size: 1 });
    }, intervalMs);
  };

  const stopPolling = () => {
    if (_pollTimer) {
      clearInterval(_pollTimer);
      _pollTimer = null;
    }
  };

  return {
    notifications,
    total,
    currentPage,
    pageSize,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    resetPage: () => (currentPage.value = 1),
    clearNotifications: () => {
      notifications.value = [];
      total.value = 0;
      currentPage.value = 1;
      unreadCount.value = 0;
    },
    startPolling,
    stopPolling,
  };
}

// ============================================================
// 统计数据
// ============================================================

export function useStats() {
  const siteStats = useState<SiteStats>('siteStats', () => ({
    total_words: '0',
    total_visitors: 0,
    total_page_views: 0,
    online_users: 0,
    total_articles: 0,
    total_comments: 0,
    total_friends: 0,
    total_moments: 0,
    total_categories: 0,
    total_tags: 0,
    today_visitors: 0,
    today_pageviews: 0,
    yesterday_visitors: 0,
    yesterday_pageviews: 0,
    month_pageviews: 0,
  }));

  const { data } = useAsyncData('site-stats', async () => {
    try {
      return await getSiteStats();
    } catch {
      return null;
    }
  });

  const stats = computed<SiteStats>(() => ({
    ...siteStats.value,
    ...(data.value ?? {}),
  }));

  function formatNumber(value: string | number): string {
    if (typeof value === 'string') return value;
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return `${value}`;
  }

  return { siteStats, stats, formatNumber };
}

export function useRunningDays(established?: string) {
  const { basicConfig } = useSysConfig();
  const startDate = computed(() => established || basicConfig.value.established || '2024-01-01');
  const runningDays = computed(() => calcRunningDays(startDate.value));
  return { runningDays };
}

export function useCounts() {
  const {
    data: articlesData,
    pending: articlesPending,
    error: articlesError,
  } = useAsyncData('sidebar-articles-count', async () => {
    try {
      const { total } = await getArticlesForWeb({ page: 1, page_size: 1 });
      return total || 0;
    } catch {
      return 0;
    }
  });

  const {
    data: categoriesData,
    pending: categoriesPending,
    error: categoriesError,
  } = useAsyncData('sidebar-categories-count', async () => {
    try {
      const { total } = await getCategories();
      return total || 0;
    } catch {
      return 0;
    }
  });

  const {
    data: tagsData,
    pending: tagsPending,
    error: tagsError,
  } = useAsyncData('sidebar-tags-count', async () => {
    try {
      const { total } = await getTags();
      return total || 0;
    } catch {
      return 0;
    }
  });

  const articlesTotal = computed(() => articlesData.value ?? 0);
  const categoriesTotal = computed(() => categoriesData.value ?? 0);
  const tagsTotal = computed(() => tagsData.value ?? 0);

  const loading = computed(
    () => articlesPending.value || categoriesPending.value || tagsPending.value
  );
  const error = computed(() => articlesError.value || categoriesError.value || tagsError.value);

  return { articlesTotal, categoriesTotal, tagsTotal, loading, error };
}

interface DisplayArchive extends ArchiveItem {
  displayText: string;
  isEarlier: boolean;
}

export async function useArchiveStats() {
  const archives = ref<ArchiveItem[]>([]);

  const { data, pending, error } = await useAsyncData('archives-stats', async () => {
    try {
      const r = await getArchiveStats();
      return r.archives || [];
    } catch {
      return [];
    }
  });
  if (data.value) {
    archives.value = data.value;
  }

  const displayArchives = computed<DisplayArchive[]>(() => {
    const list: DisplayArchive[] = archives.value.slice(0, 6).map(a => ({
      ...a,
      displayText: `${a.year} ${a.month}`,
      isEarlier: false,
    }));
    if (archives.value.length > 6) {
      const earlierCount = archives.value.slice(6).reduce((s, a) => s + a.count, 0);
      list.push({
        year: '',
        month: '',
        displayText: '在此之前',
        count: earlierCount,
        isEarlier: true,
      });
    }
    return list;
  });

  return { archives, displayArchives, loading: pending, error };
}

// ============================================================
// 系统配置
// ============================================================

export function useSysConfig() {
  const basicConfig = useState<Record<string, string>>('sysconfig-basic', () => ({
    author: '',
    author_desc: '',
    author_avatar: '',
    icp: '',
    police_record: '',
    admin_url: '',
    blog_url: '',
    home_url: '',
    title: 'FlecBLOG',
    subtitle: 'FlecBLOG',
    description: '',
    keywords: '',
    established: '',
    favicon: '',
    emojis: '',
    custom_head: '',
    custom_body: '',
    meting_api: '',
    cravatar_url: '',
    ip_api_url: '',
    cover_maker_api: '',
  }));

  const oauthConfig = useState<Record<string, string>>('sysconfig-oauth', () => ({
    'github.enabled': 'false',
    'google.enabled': 'false',
    'qq.enabled': 'false',
    'microsoft.enabled': 'false',
    'oidc.enabled': 'false',
    'wechat.enabled': 'false',
  }));

  const uploadConfig = useState<Record<string, string>>('sysconfig-upload', () => ({
    max_file_size: '5',
  }));

  function getString(key: string, fallback: string = ''): string {
    const val = basicConfig.value[key];
    return val !== undefined && val !== '' ? val : fallback;
  }

  function getNumber(key: string, fallback: number = 0): number {
    const val = basicConfig.value[key];
    if (val === undefined || val === '') return fallback;
    const parsed = Number(val);
    return isNaN(parsed) ? fallback : parsed;
  }

  function getBoolean(key: string, fallback: boolean = false): boolean {
    const val = basicConfig.value[key];
    if (val === undefined || val === '') return fallback;
    return val === 'true';
  }

  function getArray<T = unknown>(key: string, fallback: T[] = []): T[] {
    const val = basicConfig.value[key];
    if (!val) return fallback;
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }

  function getOAuthBoolean(key: string, fallback: boolean = false): boolean {
    const val = oauthConfig.value[key];
    if (val === undefined || val === '') return fallback;
    return val === 'true';
  }

  return {
    basicConfig,
    oauthConfig,
    uploadConfig,
    getString,
    getNumber,
    getBoolean,
    getArray,
    getOAuthBoolean,
  };
}
