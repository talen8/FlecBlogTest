import type { ThemeState } from '@@/types/theme';
import { getActiveThemeSchema } from '@/composables/api/theme';

export function useTheme() {
  const theme = useState<ThemeState>('active-theme', () => ({
    slug: 'default',
    name: '默认主题',
    schema: {},
    config: {},
    loaded: false,
  }));

  const config = computed(() => theme.value.config as Record<string, unknown>);

  function getString(key: string, fallback: string = ''): string {
    const val = config.value[key];
    return typeof val === 'string' && val !== '' ? val : fallback;
  }

  function getNumber(key: string, fallback: number = 0): number {
    const val = config.value[key];
    return typeof val === 'number' ? val : fallback;
  }

  function getBoolean(key: string, fallback: boolean = false): boolean {
    const val = config.value[key];
    return typeof val === 'boolean' ? val : fallback;
  }

  function getArray<T = unknown>(key: string, fallback: T[] = []): T[] {
    const val = config.value[key];
    return Array.isArray(val) ? (val as T[]) : fallback;
  }

  const fetchTheme = async () => {
    if (theme.value.loaded) return;

    try {
      const data = await getActiveThemeSchema();
      theme.value.slug = data.slug;
      theme.value.name = data.name || data.slug;
      theme.value.schema = data.schema;
      theme.value.config = data.config ?? {};
      theme.value.loaded = true;
    } catch {
      theme.value.slug = 'default';
      theme.value.name = '默认主题';
      theme.value.loaded = true;
    }
  };

  return {
    theme,
    config,
    getString,
    getNumber,
    getBoolean,
    getArray,
    fetchTheme,
  };
}
