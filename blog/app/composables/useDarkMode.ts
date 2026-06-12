import { ref, watch } from 'vue';

export const isDark = ref(false);

let initialized = false;

export function initDarkMode(): void {
  if (initialized || !import.meta.client) return;
  initialized = true;

  const currentTheme = document.documentElement.getAttribute('data-theme');
  isDark.value = currentTheme === 'dark';

  watch(isDark, dark => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', e => {
    if (!localStorage.getItem('theme')) {
      isDark.value = e.matches;
    }
  });
}

export function toggleDarkMode(): void {
  isDark.value = !isDark.value;
}
