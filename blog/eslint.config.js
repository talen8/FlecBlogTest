import { createConfigForNuxt } from '@nuxt/eslint-config/flat';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default createConfigForNuxt({
  // Nuxt 项目配置
})
  .append(eslintPluginPrettier)
  .override('nuxt/vue/rules', {
    rules: {
      'vue/multi-word-component-names': 'off',
    },
  });
