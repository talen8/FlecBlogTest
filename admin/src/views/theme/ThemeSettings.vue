<template>
  <el-card shadow="never">
    <div class="toolbar">
      <h2>主题管理</h2>
      <div class="actions">
        <el-button @click="manageDialogRef?.open()"> 主题管理 </el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!canEditSettings"
          @click="handleSave"
        >
          保存配置
        </el-button>
      </div>
    </div>

    <div class="theme-settings-tab">
      <div class="setting-form">
        <template v-if="hasSchema">
          <el-form label-position="top" :disabled="loading">
            <el-tabs v-model="activeThemeGroup" class="config-tabs">
              <el-tab-pane label="主题信息" name="_info">
                <ThemeInfoPanel :theme-detail="themeDetail" />
              </el-tab-pane>

              <el-tab-pane label="菜单管理" name="_menus">
                <ThemeMenuManager
                  ref="menuManagerRef"
                  :active-slug="activeSlug"
                  :menu-slots="menuSlots"
                  :theme-name="themeDetail.name || themeDetail.slug"
                />
              </el-tab-pane>

              <el-tab-pane
                v-for="group in schemaGroups"
                :key="group.name"
                :label="group.name || '配置项'"
                :name="group.name || '_default'"
              >
                <template v-for="(field, key) in group.fields" :key="key">
                  <!-- string（无 enum） -->
                  <el-form-item v-if="field.type === 'string' && !field.enum">
                    <template #label>
                      <span>{{ field.title || String(key) }}</span>
                      <div v-if="field.description" class="field-desc">{{ field.description }}</div>
                    </template>
                    <el-input
                      v-if="field.format === 'color'"
                      v-model="configValues[String(key)]"
                      type="color"
                      style="width: 120px"
                    />
                    <el-input
                      v-else-if="field.format === 'textarea'"
                      v-model="configValues[String(key)]"
                      type="textarea"
                      :rows="4"
                      :minlength="field.min"
                      :maxlength="field.max"
                      :placeholder="field.placeholder || ''"
                    />
                    <el-date-picker
                      v-else-if="field.format === 'date'"
                      v-model="configValues[String(key)]"
                      type="date"
                      value-format="YYYY-MM-DD"
                      placeholder="选择日期"
                    />
                    <el-time-picker
                      v-else-if="field.format === 'time'"
                      v-model="configValues[String(key)]"
                      value-format="HH:mm:ss"
                      placeholder="选择时间"
                    />
                    <el-date-picker
                      v-else-if="field.format === 'date-time'"
                      v-model="configValues[String(key)]"
                      type="datetime"
                      value-format="YYYY-MM-DDTHH:mm:ss"
                      placeholder="选择日期时间"
                    />
                    <el-input
                      v-else-if="field.format === 'upload'"
                      v-model="configValues[String(key)]"
                      :placeholder="field.placeholder || field.description || '图片URL'"
                    >
                      <template #append>
                        <el-upload
                          :show-file-list="false"
                          :http-request="
                            (opts: UploadRequestOptions) => handleSimpleUpload(String(key), opts)
                          "
                          accept="image/*"
                        >
                          <el-button :icon="Upload" :loading="simpleUploadKey === String(key)" />
                        </el-upload>
                      </template>
                    </el-input>
                    <ImageUploader
                      v-else-if="field.format === 'image'"
                      :ref="(el: unknown) => setImageUploaderRef(String(key), el)"
                      v-model="configValues[String(key)]"
                      upload-type="主题图片"
                      :width="(field.width || 120) + 'px'"
                      :height="(field.height || 120) + 'px'"
                    />
                    <el-input
                      v-else
                      v-model="configValues[String(key)]"
                      :minlength="field.min"
                      :maxlength="field.max"
                      :placeholder="field.placeholder || ''"
                    />
                  </el-form-item>

                  <!-- string + enum -->
                  <el-form-item v-else-if="field.type === 'string' && field.enum">
                    <template #label>
                      <span>{{ field.title || String(key) }}</span>
                      <div v-if="field.description" class="field-desc">{{ field.description }}</div>
                    </template>
                    <el-select
                      v-model="configValues[String(key)]"
                      :placeholder="field.placeholder || '请选择'"
                    >
                      <el-option
                        v-for="opt in field.enum"
                        :key="typeof opt === 'object' ? opt.value : String(opt)"
                        :label="typeof opt === 'object' ? opt.label : String(opt)"
                        :value="typeof opt === 'object' ? opt.value : opt"
                      />
                    </el-select>
                  </el-form-item>

                  <!-- boolean -->
                  <el-form-item v-else-if="field.type === 'boolean'">
                    <template #label>
                      <span>{{ field.title || String(key) }}</span>
                      <div v-if="field.description" class="field-desc">{{ field.description }}</div>
                    </template>
                    <el-switch v-model="configValues[String(key)]" />
                  </el-form-item>

                  <!-- number / integer -->
                  <el-form-item v-else-if="field.type === 'number' || field.type === 'integer'">
                    <template #label>
                      <span>{{ field.title || String(key) }}</span>
                      <div v-if="field.description" class="field-desc">{{ field.description }}</div>
                    </template>
                    <el-input-number
                      v-model="configValues[String(key)]"
                      :min="field.min"
                      :max="field.max"
                      :step="field.type === 'integer' ? 1 : 0.1"
                    />
                  </el-form-item>

                  <!-- array -->
                  <el-form-item v-else-if="field.type === 'array'">
                    <template #label>
                      <span>{{ field.title || String(key) }}</span>
                      <div v-if="field.description" class="field-desc">{{ field.description }}</div>
                    </template>
                    <JsonListEditor
                      v-model="configValues[String(key)]"
                      :fields="buildItemFields(field['x-item-fields'] || [])"
                      :default-item="buildDefaultItem(field['x-item-fields'] || [])"
                      :min="field.min"
                      :max="field.max"
                    />
                  </el-form-item>
                </template>
              </el-tab-pane>
            </el-tabs>
          </el-form>
        </template>

        <el-empty v-else-if="!loading" description="当前主题没有可配置项" />
      </div>

      <ThemeManageDialog
        ref="manageDialogRef"
        @change="fetchThemeConfig"
        @task="startTaskPolling"
      />

      <el-dialog
        v-model="taskDialogVisible"
        :title="`${taskTargetTitle}进度`"
        width="400px"
        :close-on-click-modal="false"
        :close-on-press-escape="false"
        :show-close="taskStatus === 'done' || taskStatus === 'error'"
        @closed="handleTaskDialogClosed"
      >
        <div style="text-align: center; padding: 12px 0">
          <p style="margin-bottom: 16px; font-size: 14px">{{ taskMessage }}</p>
          <el-progress
            v-if="taskProgress !== undefined"
            :percentage="taskProgress"
            :status="
              taskStatus === 'done' ? 'success' : taskStatus === 'error' ? 'exception' : undefined
            "
            :stroke-width="10"
            style="margin-bottom: 12px"
          />
          <el-progress
            v-else-if="taskStatus !== 'done' && taskStatus !== 'error'"
            :percentage="100"
            :indeterminate="true"
            :stroke-width="8"
            :show-text="false"
            status="warning"
          />
          <p v-if="taskStatus === 'done'" style="color: var(--el-color-success); font-size: 14px">
            操作已完成
          </p>
          <p v-if="taskStatus === 'error'" style="color: var(--el-color-danger); font-size: 14px">
            操作失败
          </p>
        </div>
        <template #footer>
          <el-button
            v-if="taskStatus === 'done' || taskStatus === 'error'"
            @click="taskDialogVisible = false"
          >
            关闭
          </el-button>
        </template>
      </el-dialog>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, type UploadRequestOptions } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { uploadFile } from '@/api/file';
import { getThemes, getTheme, updateThemeConfig, getThemeTaskStatus } from '@/api/theme';
import type { Theme, SchemaField, ThemeSchema, MenuSlot } from '@/types/theme';
import { isSuperAdmin } from '@/utils/auth';
import JsonListEditor from '@/components/common/JsonListEditor.vue';
import type { FieldConfig } from '@/components/common/JsonListEditor.vue';
import ImageUploader from '@/components/common/ImageUploader.vue';
import ThemeInfoPanel from './components/ThemeInfoPanel.vue';
import ThemeMenuManager from './components/ThemeMenuManager.vue';
import ThemeManageDialog from './components/ThemeManageDialog.vue';

const loading = ref(false);
const saving = ref(false);
const activeSlug = ref('');
const canEditSettings = computed(() => isSuperAdmin());

const themeDetail = ref<Theme>({
  slug: '',
  name: '',
  is_active: false,
  config: {},
  schema: {},
  menus: {},
  version: '',
  author: '',
  description: '',
  cover: '',
  license: '',
  repo: '',
  created_at: '',
  updated_at: '',
});

const simpleUploadKey = ref<string | null>(null);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const configValues = ref<Record<string, any>>({});

const taskTarget = ref('');
const taskStatus = ref('');
const taskMessage = ref('');
const taskProgress = ref<number | undefined>(undefined);
const taskDialogVisible = ref(false);
let taskPollTimer: ReturnType<typeof setInterval> | null = null;

const manageDialogRef = ref<InstanceType<typeof ThemeManageDialog> | null>(null);
const menuManagerRef = ref<InstanceType<typeof ThemeMenuManager> | null>(null);

const handleSimpleUpload = async (key: string, opts: UploadRequestOptions) => {
  const file = opts.file as File;
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件');
    return;
  }
  simpleUploadKey.value = key;
  try {
    const result = await uploadFile(file, '主题图片');
    configValues.value[key] = result.file_url;
  } catch (e) {
    ElMessage.error((e as Error)?.message || '上传失败');
  } finally {
    simpleUploadKey.value = null;
  }
};

const imageUploaderRefs = ref<Record<string, InstanceType<typeof ImageUploader>>>({});
const setImageUploaderRef = (key: string, el: unknown) => {
  if (el) {
    imageUploaderRefs.value[key] = el as InstanceType<typeof ImageUploader>;
  } else {
    delete imageUploaderRefs.value[key];
  }
};

const hasSchema = computed(() => {
  return schema.value && Object.keys(schema.value).length > 0;
});

const schema = ref<ThemeSchema>({});
const schemaProperties = computed(() => {
  return schema.value || {};
});

const activeThemeGroup = ref('_info');

const menuSlots = computed<MenuSlot[]>(() => {
  const menusSchema = schema.value?.['$menus'];
  if (menusSchema && typeof menusSchema === 'object' && !('type' in menusSchema)) {
    return Object.entries(menusSchema).map(([key, val]) => {
      const v = val as Record<string, unknown>;
      return {
        key,
        label: (v?.label as string) || key,
        maxDepth: (v?.maxDepth as number) || 2,
      };
    });
  }
  return [];
});

const schemaGroups = computed(() => {
  const props = schemaProperties.value;
  if (!props || typeof props !== 'object') return [];
  const entries = Object.entries(props).filter(([key]) => !key.startsWith('$'));
  if (entries.length === 0) return [];
  const firstVal = entries[0]?.[1];
  if (firstVal && typeof firstVal === 'object' && 'type' in firstVal) {
    return [{ name: '', fields: props as unknown as Record<string, SchemaField> }];
  }
  const groups: { name: string; fields: Record<string, SchemaField> }[] = [];
  for (const [name, val] of entries) {
    if (val && typeof val === 'object' && !('type' in val)) {
      groups.push({ name, fields: val as unknown as Record<string, SchemaField> });
    }
  }
  return groups;
});

const fetchThemeConfig = async () => {
  loading.value = true;
  try {
    const themes = await getThemes();
    const active = themes.find(t => t.is_active);
    if (!active) {
      loading.value = false;
      return;
    }
    activeSlug.value = active.slug;

    const theme = await getTheme(active.slug);
    themeDetail.value = theme;
    schema.value = theme.schema || {};
    const config = theme.config || {};

    const collectDefaults = (obj: ThemeSchema, out: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(obj)) {
        if (k === 'groups') continue;
        if (v && typeof v === 'object' && 'type' in v) {
          const field = v as SchemaField;
          if (field.default !== undefined) out[k] = field.default;
        } else if (v && typeof v === 'object') {
          collectDefaults(v as ThemeSchema, out);
        }
      }
    };
    const defaults: Record<string, unknown> = {};
    collectDefaults(schema.value || {}, defaults);
    configValues.value = { ...defaults, ...config };

    menuManagerRef.value?.initMenuType();
  } catch {
    ElMessage.error('获取主题配置失败');
  } finally {
    loading.value = false;
  }
};

const buildItemFields = (itemFields: Array<string | Record<string, unknown>>): FieldConfig[] => {
  if (!itemFields || itemFields.length === 0) return [];
  if (typeof itemFields[0] === 'string') {
    return (itemFields as string[]).map(key => ({ key, type: 'text' as const, placeholder: key }));
  }
  return itemFields as unknown as FieldConfig[];
};

const buildDefaultItem = (
  itemFields: Array<string | Record<string, unknown>>
): Record<string, unknown> => {
  if (!itemFields || itemFields.length === 0) return {};
  if (typeof itemFields[0] === 'string') {
    const obj: Record<string, unknown> = {};
    (itemFields as string[]).forEach(k => {
      obj[k] = '';
    });
    return obj;
  }
  const obj: Record<string, unknown> = {};
  (itemFields as Array<Record<string, unknown>>).forEach(field => {
    const key = field.key as string;
    obj[key] = '';
  });
  return obj;
};

const handleSave = async () => {
  if (!canEditSettings.value) {
    ElMessage.warning('仅超级管理员可修改主题配置');
    return;
  }
  if (!activeSlug.value) return;
  saving.value = true;
  try {
    const uploadPromises: Promise<void>[] = [];
    for (const [key, uploader] of Object.entries(imageUploaderRefs.value)) {
      if (uploader?.getPendingCount()) {
        uploadPromises.push(
          uploader.uploadPendingFile().then(url => {
            if (url) configValues.value[key] = url;
          })
        );
      }
    }
    if (uploadPromises.length > 0) {
      const results = await Promise.allSettled(uploadPromises);
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        ElMessage.error(`${failed.length} 个图片上传失败，请重试`);
        return;
      }
    }

    await updateThemeConfig(activeSlug.value, { config: configValues.value });
    ElMessage.success('主题配置保存成功');
  } catch (err: unknown) {
    ElMessage.error((err as { message?: string })?.message || '保存主题配置失败');
  } finally {
    saving.value = false;
  }
};

const taskTargetTitle = computed(() => {
  const titles: Record<string, string> = {
    'theme-install': '主题安装',
    'theme-upgrade': '主题升级',
    'theme-activate': '主题激活',
    'blog-rebuild': 'Blog 重建',
    'system-upgrade': '系统升级',
  };
  return titles[taskTarget.value] || '任务';
});

const startTaskPolling = () => {
  stopTaskPolling();
  taskTarget.value = '';
  taskStatus.value = 'starting';
  taskMessage.value = '正在提交任务...';
  taskProgress.value = undefined;
  taskDialogVisible.value = true;

  taskPollTimer = setInterval(async () => {
    try {
      const data = await getThemeTaskStatus();
      taskTarget.value = data.target;
      taskStatus.value = data.status;
      taskMessage.value = data.message;
      taskProgress.value = data.progress;

      if (data.status === 'idle') {
        taskStatus.value = 'done';
        taskMessage.value = '操作已完成';
        stopTaskPolling();
        ElMessage.success('任务已完成');
      } else if (data.status === 'done') {
        stopTaskPolling();
        ElMessage.success('任务已完成');
      } else if (data.status === 'error') {
        stopTaskPolling();
        ElMessage.error(data.message || '任务执行失败');
      }
    } catch {
      // 请求失败忽略，继续轮询
    }
  }, 2000);
};

const stopTaskPolling = () => {
  if (taskPollTimer) {
    clearInterval(taskPollTimer);
    taskPollTimer = null;
  }
};

const handleTaskDialogClosed = () => {
  fetchThemeConfig();
};

onMounted(fetchThemeConfig);
onUnmounted(() => stopTaskPolling());
</script>

<style lang="scss" scoped>
.el-card {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
}

.toolbar {
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 500;
  }

  .actions {
    display: flex;
    gap: 12px;

    .el-button {
      margin: 0;
    }
  }
}

.theme-settings-tab {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.setting-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.el-form) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.config-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .el-tabs__header {
    margin: 0 0 12px 0;
    flex-shrink: 0;
  }

  .el-tabs__content {
    flex: 1;
    overflow: hidden;
  }

  .el-tab-pane {
    height: 100%;
    overflow-y: auto;
  }
}

:deep(.el-form-item) {
  margin-bottom: 20px;

  .el-form-item__label {
    font-weight: 500;
  }
}

.el-select {
  width: 100%;
}

.field-desc {
  font-size: 12px;
  color: #909399;
  font-weight: normal;
  line-height: 1.4;
  margin-top: 2px;
}
</style>
