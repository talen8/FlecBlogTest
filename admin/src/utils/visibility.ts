import { reactive } from 'vue';
import { getThemes, getTheme } from '@/api/theme';

const state = reactive({
  loaded: false,
  features: {} as Record<string, boolean>,
});

async function loadFeatures() {
  try {
    const themes = await getThemes();
    const active = themes.find(t => t.is_active);
    if (!active) {
      state.loaded = true;
      return;
    }
    const theme = await getTheme(active.slug);
    const raw = (theme.schema as Record<string, unknown>)?.['$features'];
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        state.features[k] = v !== false;
      }
    }
  } finally {
    state.loaded = true;
  }
}

export function useThemeFeatures() {
  if (!state.loaded) loadFeatures();
  return {
    isFeatureEnabled: (key: string) => state.features[key] ?? true,
  };
}
