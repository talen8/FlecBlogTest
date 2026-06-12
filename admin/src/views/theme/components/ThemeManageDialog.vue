<template>
  <el-dialog v-model="visible" title="主题管理" width="90%" style="max-width: 720px">
    <div class="manage-install-bar">
      <el-input
        v-model="installSlug"
        placeholder="输入主题标识（slug）"
        clearable
        style="flex: 1"
        @keyup.enter="handleInstallBySlug"
      >
        <template #prefix>
          <i class="ri-download-2-line"></i>
        </template>
      </el-input>
      <el-button
        type="primary"
        :loading="installing"
        :disabled="!installSlug.trim()"
        @click="handleInstallBySlug"
      >
        获取
      </el-button>
      <a href="https://hub.flec.top/themes" target="_blank" class="hub-link">
        寻找主题 <i class="ri-external-link-line"></i>
      </a>
    </div>

    <el-table v-loading="manageLoading" :data="localThemes" style="margin: 16px 0" max-height="400">
      <el-table-column prop="name" label="主题名" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.name || row.slug }}</template>
      </el-table-column>
      <el-table-column prop="slug" label="标识" width="120" show-overflow-tooltip />
      <el-table-column prop="version" label="版本" width="120" align="center">
        <template #default="{ row }">
          <span>v{{ row.version }}</span>
          <template v-if="row.latest_version">
            <i class="ri-arrow-right-line" style="margin: 0 2px; color: var(--el-color-info)"></i>
            <span style="color: var(--el-color-primary)">v{{ row.latest_version }}</span>
          </template>
        </template>
      </el-table-column>
      <el-table-column prop="author" label="作者" width="100" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.is_active" type="success" size="small" effect="dark">激活</el-tag>
          <el-tag v-if="row.latest_version" type="warning" size="small" style="margin-left: 4px">
            可更新
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.latest_version"
            type="primary"
            link
            size="small"
            :loading="upgradingSlug === row.slug"
            @click="handleUpgrade(row.slug)"
            >升级</el-button
          >
          <el-button
            v-if="!row.is_active"
            link
            size="small"
            :loading="activatingSlug === row.slug"
            @click="handleActivate(row.slug)"
            >启用</el-button
          >
          <el-button
            v-if="!row.is_active"
            type="danger"
            link
            size="small"
            :loading="deletingSlug === row.slug"
            @click="handleDelete(row.slug)"
            >删除</el-button
          >
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { getThemes, activateTheme, installThemeBySlug, deleteTheme } from '@/api/theme';
import type { ThemeListItem } from '@/types/theme';

const emit = defineEmits<{
  change: [];
  task: [];
}>();

const visible = ref(false);
const manageLoading = ref(false);
const localThemes = ref<ThemeListItem[]>([]);
const installSlug = ref('');
const installing = ref(false);
const activatingSlug = ref('');
const deletingSlug = ref('');
const upgradingSlug = ref('');

const open = async () => {
  visible.value = true;
  await fetchLocalThemes();
};

const fetchLocalThemes = async () => {
  manageLoading.value = true;
  try {
    localThemes.value = await getThemes();
  } catch {
    ElMessage.error('获取主题列表失败');
  } finally {
    manageLoading.value = false;
  }
};

const handleInstallBySlug = async () => {
  const slug = installSlug.value.trim();
  if (!slug) return;
  if (localThemes.value.some(t => t.slug === slug)) {
    ElMessage.warning('该主题已安装');
    return;
  }
  installing.value = true;
  try {
    await installThemeBySlug(slug);
    installSlug.value = '';
    emit('task');
    emit('change');
  } catch (e) {
    ElMessage.error((e as Error)?.message || '安装失败');
  } finally {
    installing.value = false;
  }
};

const handleActivate = async (slug: string) => {
  activatingSlug.value = slug;
  try {
    await activateTheme(slug);
    emit('task');
    emit('change');
  } catch (e) {
    ElMessage.error((e as Error)?.message || '启用失败');
  } finally {
    activatingSlug.value = '';
  }
};

const handleDelete = async (slug: string) => {
  try {
    await ElMessageBox.confirm('确定要删除该主题吗？此操作不可恢复。', '删除主题', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }
  deletingSlug.value = slug;
  try {
    await deleteTheme(slug);
    ElMessage.success('主题已删除');
    await fetchLocalThemes();
  } catch (e) {
    ElMessage.error((e as Error)?.message || '删除失败');
  } finally {
    deletingSlug.value = '';
  }
};

const handleUpgrade = async (slug: string) => {
  upgradingSlug.value = slug;
  try {
    await installThemeBySlug(slug);
    emit('task');
    emit('change');
  } catch (e) {
    ElMessage.error((e as Error)?.message || '升级失败');
  } finally {
    upgradingSlug.value = '';
  }
};

defineExpose({ open });
</script>

<style lang="scss" scoped>
.manage-install-bar {
  display: flex;
  align-items: center;
  gap: 10px;

  .hub-link {
    white-space: nowrap;
    font-size: 13px;
    color: var(--el-color-primary);
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }

    i {
      font-size: 12px;
    }
  }
}
</style>
