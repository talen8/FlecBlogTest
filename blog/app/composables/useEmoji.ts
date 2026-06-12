import type { EmojiGroup } from '@@/types/emoji';
import { loadAllEmojiGroups, getAllEmojiGroupsSync } from '@/utils/emoji';

export function useEmoji() {
  const { basicConfig } = useSysConfig();

  const emojiGroups = ref<EmojiGroup[]>([]);
  const loading = ref(true);
  const error = ref('');

  const load = async () => {
    // 优先读取已有缓存（app.vue 初始化时已加载）
    const cached = getAllEmojiGroupsSync();
    if (cached && cached.length > 0) {
      emojiGroups.value = cached;
      loading.value = false;
      return;
    }

    const emojisUrl = basicConfig.value.emojis;
    if (!emojisUrl) {
      error.value = '未配置表情包';
      loading.value = false;
      return;
    }

    try {
      const groups = await loadAllEmojiGroups(emojisUrl);
      if (groups.length === 0) throw new Error('加载表情包失败');
      emojiGroups.value = groups;
    } catch (err: unknown) {
      error.value = (err as Error).message || '加载表情包失败';
    } finally {
      loading.value = false;
    }
  };

  return { emojiGroups, loading, error, load };
}
