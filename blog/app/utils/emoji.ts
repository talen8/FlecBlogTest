import type { EmojiGroup } from '@@/types/emoji';

let emojiMapCache: Map<string, string> | null = null;
let emojiLoadPromise: Promise<Map<string, string>> | null = null;
let emojiGroupsCache: EmojiGroup[] | null = null;
let emojiGroupsLoadPromise: Promise<EmojiGroup[]> | null = null;

export async function loadEmojiMap(emojisUrl: string): Promise<Map<string, string>> {
  if (emojiMapCache) {
    return emojiMapCache;
  }

  if (emojiLoadPromise) {
    return emojiLoadPromise;
  }

  emojiLoadPromise = (async () => {
    try {
      const response = await fetch(emojisUrl);
      if (!response.ok) throw new Error('加载表情包失败');

      const data: EmojiGroup[] = await response.json();
      const map = new Map<string, string>();

      for (const group of data) {
        if (group.type === 'image') {
          for (const item of group.items) {
            map.set(item.key, item.val);
          }
        }
      }

      emojiMapCache = map;
      return map;
    } catch (error) {
      console.error('加载表情映射失败:', error);
      emojiLoadPromise = null;
      return new Map();
    }
  })();

  return emojiLoadPromise;
}

export function getEmojiMapSync(): Map<string, string> | null {
  return emojiMapCache;
}

export function clearEmojiCache(): void {
  emojiMapCache = null;
  emojiLoadPromise = null;
  emojiGroupsCache = null;
  emojiGroupsLoadPromise = null;
}

// 加载完整表情分组（供 EmojiPicker 使用）
export async function loadAllEmojiGroups(emojisUrl: string): Promise<EmojiGroup[]> {
  if (emojiGroupsCache) return emojiGroupsCache;
  if (emojiGroupsLoadPromise) return emojiGroupsLoadPromise;

  emojiGroupsLoadPromise = (async () => {
    try {
      const response = await fetch(emojisUrl);
      if (!response.ok) throw new Error('加载表情包失败');
      const groups: EmojiGroup[] = await response.json();
      emojiGroupsCache = groups;
      return groups;
    } catch (error) {
      console.error('加载表情分组失败:', error);
      emojiGroupsLoadPromise = null;
      return [];
    }
  })();

  return emojiGroupsLoadPromise;
}

export function getAllEmojiGroupsSync(): EmojiGroup[] | null {
  return emojiGroupsCache;
}

export function replaceEmojisInText(text: string, emojiMap: Map<string, string>): string {
  return text.replace(/:([^:\s]+):/g, (match, key) => {
    const url = emojiMap.get(key);
    if (url) {
      return `<img src="${url}" alt="${key}" class="emoji-image" title="${key}" />`;
    }
    return match;
  });
}
