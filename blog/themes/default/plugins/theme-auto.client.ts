export default defineNuxtPlugin(() => {
  const { config: themeConfig, getString } = useTheme();

  const tryInit = () => {
    initAutoSwitch({
      lightStart: getString('theme_light_start', '06:00'),
      darkStart: getString('theme_dark_start', '18:00'),
    });
  };

  tryInit();
  watch(themeConfig, tryInit, { deep: true });
});
