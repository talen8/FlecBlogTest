export interface DarkModeAutoSwitchConfig {
  lightStart: string;
  darkStart: string;
}

const parseTimeToMinutes = (timeStr: string): number => {
  const parts = timeStr.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
};

const getCurrentMinutes = (): number => {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
};

const shouldBeDarkByTime = (config: DarkModeAutoSwitchConfig): boolean => {
  const currentMinutes = getCurrentMinutes();
  const lightStartMinutes = parseTimeToMinutes(config.lightStart);
  const darkStartMinutes = parseTimeToMinutes(config.darkStart);

  if (lightStartMinutes < darkStartMinutes) {
    return !(currentMinutes >= lightStartMinutes && currentMinutes < darkStartMinutes);
  }
  return currentMinutes >= darkStartMinutes || currentMinutes < lightStartMinutes;
};

const getMsToNextSwitch = (config: DarkModeAutoSwitchConfig): number => {
  const currentMinutes = getCurrentMinutes();
  const lightStartMinutes = parseTimeToMinutes(config.lightStart);
  const darkStartMinutes = parseTimeToMinutes(config.darkStart);

  let nextSwitchMinutes: number;

  if (lightStartMinutes < darkStartMinutes) {
    if (currentMinutes < lightStartMinutes) {
      nextSwitchMinutes = lightStartMinutes;
    } else if (currentMinutes < darkStartMinutes) {
      nextSwitchMinutes = darkStartMinutes;
    } else {
      nextSwitchMinutes = lightStartMinutes + 24 * 60;
    }
  } else {
    if (currentMinutes < darkStartMinutes) {
      nextSwitchMinutes = darkStartMinutes;
    } else if (currentMinutes < lightStartMinutes) {
      nextSwitchMinutes = lightStartMinutes;
    } else {
      nextSwitchMinutes = darkStartMinutes + 24 * 60;
    }
  }

  const minutesUntilSwitch = nextSwitchMinutes - currentMinutes;
  return minutesUntilSwitch * 60 * 1000;
};

let autoSwitchTimer: ReturnType<typeof setTimeout> | null = null;

const setupAutoSwitchTimer = (config: DarkModeAutoSwitchConfig): void => {
  if (autoSwitchTimer) {
    clearTimeout(autoSwitchTimer);
    autoSwitchTimer = null;
  }

  const msToNextSwitch = getMsToNextSwitch(config);
  autoSwitchTimer = setTimeout(() => {
    const shouldBeDark = shouldBeDarkByTime(config);
    if (isDark.value !== shouldBeDark) {
      isDark.value = shouldBeDark;
    }
    setupAutoSwitchTimer(config);
  }, msToNextSwitch);
};

export const initAutoSwitch = (config: DarkModeAutoSwitchConfig): void => {
  initDarkMode();
  if (config.lightStart !== config.darkStart) {
    isDark.value = shouldBeDarkByTime(config);
    setupAutoSwitchTimer(config);
  }
};
