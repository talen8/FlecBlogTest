import { getFriends, applyFriend as applyFriendApi } from '@/composables/api/friend';
import type { Friend, FriendGroup, FriendApplyRequest } from '@@/types/friend';

export function useFriendList() {
  const friends = useState<Friend[]>('friends', () => []);
  const allGroups = useState<FriendGroup[]>('friend-groups', () => []);
  const loading = ref(false);
  const error = ref<Error | null>(null);

  async function fetchFriends() {
    loading.value = true;
    error.value = null;
    try {
      const data = await getFriends();
      const all: Friend[] = [];
      data.groups?.forEach(group => {
        group.friends.forEach(friend => {
          if (!friend.is_invalid) {
            all.push(friend);
          }
        });
      });
      friends.value = all;
      allGroups.value = data.groups || [];
    } catch (e) {
      console.error('获取友链失败:', e);
      error.value = e instanceof Error ? e : new Error(String(e));
      friends.value = [];
      allGroups.value = [];
    } finally {
      loading.value = false;
    }
  }

  const { data: initialData } = useAsyncData(
    'footer-friends',
    async () => {
      try {
        const data = await getFriends();
        const all: Friend[] = [];
        data.groups?.forEach(group => {
          group.friends.forEach(friend => {
            if (!friend.is_invalid) {
              all.push(friend);
            }
          });
        });
        return { friends: all, groups: data.groups || [] };
      } catch {
        return { friends: [], groups: [] };
      }
    },
    { lazy: true }
  );
  watchEffect(() => {
    if (initialData.value) {
      friends.value = initialData.value.friends;
      allGroups.value = initialData.value.groups;
    }
  });

  function getRandom(count: number): Friend[] {
    if (friends.value.length <= count) return friends.value;
    return [...friends.value].sort(() => Math.random() - 0.5).slice(0, count);
  }

  const friendGroups = computed(() =>
    allGroups.value
      .map(g => ({ ...g, friends: g.friends.filter(f => !f.is_invalid) }))
      .filter(g => g.friends.length > 0)
  );

  const invalidFriendGroups = computed(() =>
    allGroups.value
      .map(g => ({ ...g, friends: g.friends.filter(f => f.is_invalid) }))
      .filter(g => g.friends.length > 0)
  );

  const isEmpty = computed(
    () => allGroups.value.length === 0 || allGroups.value.every(g => g.friends.length === 0)
  );

  async function applyFriend(data: FriendApplyRequest): Promise<void> {
    await applyFriendApi(data);
    await fetchFriends();
  }

  return {
    friends,
    allGroups,
    friendGroups,
    invalidFriendGroups,
    isEmpty,
    loading,
    error,
    fetchFriends,
    getRandom,
    applyFriend,
  };
}
