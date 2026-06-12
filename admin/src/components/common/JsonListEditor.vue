<template>
  <div class="json-list-editor">
    <div v-for="(item, index) in internalValue" :key="index" class="editor-item">
      <!-- 排序按钮 -->
      <template v-if="!hideControls">
        <el-button
          :icon="ArrowUp"
          circle
          size="small"
          @click="moveUp(index)"
          :disabled="disabled || index === 0"
        />
        <el-button
          :icon="ArrowDown"
          circle
          size="small"
          @click="moveDown(index)"
          :disabled="disabled || index === internalValue.length - 1"
          style="margin-left: 0"
        />
      </template>

      <!-- 动态字段 -->
      <template v-for="field in fields" :key="field.key">
        <!-- 颜色选择器：自然宽度，不参与 flex -->
        <el-color-picker
          v-if="field.type === 'color'"
          v-model="item[field.key]"
          :disabled="disabled"
          @change="emitUpdate"
        />

        <!-- 其他字段：flex 按 width 权重分配 -->
        <div v-else :style="{ flex: field.width ?? 1 }">
          <!-- 文本输入 -->
          <el-input
            v-if="field.type === 'text'"
            v-model="item[field.key]"
            :placeholder="field.placeholder"
            :style="field.style"
            :disabled="disabled"
            @input="emitUpdate"
          />

          <!-- 下拉选择 -->
          <el-select
            v-else-if="field.type === 'select'"
            v-model="item[field.key]"
            :placeholder="field.placeholder"
            :style="field.style"
            :disabled="disabled"
            :filterable="field.filterable"
            :allow-create="field.allowCreate"
            @change="emitUpdate"
          >
            <template v-if="field.prefix" #prefix>{{ field.prefix }}</template>
            <el-option
              v-for="option in field.options"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            >
              <template v-if="option.icon">
                <i :class="option.icon" style="margin-right: 8px; font-size: 16px"></i>
                {{ option.label }}
              </template>
            </el-option>
          </el-select>

          <!-- 带上传的文本输入 -->
          <el-input
            v-else-if="field.type === 'upload'"
            v-model="item[field.key]"
            :placeholder="field.placeholder || '图片URL'"
            :style="field.style"
            :disabled="disabled"
            @input="emitUpdate"
          >
            <template #append>
              <el-upload
                :show-file-list="false"
                :http-request="(opts: UploadRequestOptions) => handleUpload(opts, index, field)"
                accept="image/*"
                :disabled="disabled"
              >
                <el-button :icon="Upload" :loading="uploadingKey === `${index}-${field.key}`" />
              </el-upload>
            </template>
          </el-input>

          <!-- 日期 -->
          <el-date-picker
            v-else-if="field.type === 'date'"
            v-model="item[field.key]"
            type="date"
            value-format="YYYY-MM-DD"
            :placeholder="field.placeholder || '选择日期'"
            :disabled="disabled"
            @change="emitUpdate"
          />

          <!-- 时间 -->
          <el-time-picker
            v-else-if="field.type === 'time'"
            v-model="item[field.key]"
            value-format="HH:mm:ss"
            :placeholder="field.placeholder || '选择时间'"
            :disabled="disabled"
            @change="emitUpdate"
          />

          <!-- 日期时间 -->
          <el-date-picker
            v-else-if="field.type === 'datetime'"
            v-model="item[field.key]"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            :placeholder="field.placeholder || '选择日期时间'"
            :disabled="disabled"
            @change="emitUpdate"
          />
        </div>
      </template>

      <!-- 删除按钮 -->
      <el-button
        v-if="!hideControls && !isFixed"
        type="danger"
        :icon="Delete"
        circle
        size="small"
        @click="removeItem(index)"
        :disabled="disabled || internalValue.length <= (props.min ?? 0)"
      />
    </div>

    <!-- 添加按钮行 -->
    <div v-if="!hideControls && !isFixed && !isAtMax" class="editor-item add-row">
      <el-button
        type="primary"
        :icon="Plus"
        circle
        size="small"
        @click="addItem"
        :disabled="disabled"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Delete, Plus, ArrowUp, ArrowDown, Upload } from '@element-plus/icons-vue';
import { ElMessage, type UploadRequestOptions } from 'element-plus';
import { uploadFile } from '@/api/file';

export interface FieldConfig {
  key: string;
  type: 'text' | 'select' | 'color' | 'upload' | 'date' | 'time' | 'datetime';
  placeholder?: string;
  /** 列宽权重，默认 1，设 2 即占两倍宽 */
  width?: number;
  style?: string;
  prefix?: string;
  filterable?: boolean;
  allowCreate?: boolean;
  options?: Array<{ label: string; value: string; icon?: string }>;
  uploadType?: string;
}

export interface JsonListEditorProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modelValue: any[];
  fields: FieldConfig[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultItem?: Record<string, any>;
  disabled?: boolean;
  hideControls?: boolean;
  min?: number;
  max?: number;
}

const props = withDefaults(defineProps<JsonListEditorProps>(), {
  disabled: false,
  defaultItem: () => ({}),
  hideControls: false,
  min: 0,
  max: undefined,
});

const emit = defineEmits<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  'update:modelValue': [value: any[]];
}>();

// 内部值（深拷贝避免直接修改 prop）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const internalValue = ref<any[]>([]);

// 上传状态
const uploadingKey = ref<string | null>(null);

// 是否固定数量
const isFixed = computed(() => {
  return props.min != null && props.max != null && props.min === props.max && props.min > 0;
});

// 是否已达上限
const isAtMax = computed(() => {
  return props.max != null && internalValue.value.length >= props.max;
});

// 生成默认项
const makeDefaultItem = (): Record<string, unknown> => {
  const item: Record<string, unknown> = { ...props.defaultItem };
  props.fields.forEach(({ key }) => {
    if (!(key in item)) item[key] = '';
  });
  return item;
};

// 监听 modelValue 变化
watch(
  () => props.modelValue,
  newVal => {
    const arr = JSON.parse(JSON.stringify(newVal || []));
    // 最少显示 1 行；min > 0 时补齐到 min 数量
    const minRows = Math.max(1, props.min ?? 1);
    if (arr.length < minRows) {
      while (arr.length < minRows) {
        arr.push(makeDefaultItem());
      }
    }
    internalValue.value = arr;
  },
  { immediate: true, deep: true }
);

// 发送更新
const emitUpdate = () => {
  emit('update:modelValue', JSON.parse(JSON.stringify(internalValue.value)));
};

// 上移
const moveUp = (index: number) => {
  if (index <= 0) return;
  [internalValue.value[index], internalValue.value[index - 1]] = [
    internalValue.value[index - 1],
    internalValue.value[index],
  ];
  emitUpdate();
};

// 下移
const moveDown = (index: number) => {
  if (index >= internalValue.value.length - 1) return;
  [internalValue.value[index], internalValue.value[index + 1]] = [
    internalValue.value[index + 1],
    internalValue.value[index],
  ];
  emitUpdate();
};

// 删除项
const removeItem = (index: number) => {
  // min 保护：不低于最小数量
  if (props.min != null && internalValue.value.length <= props.min) return;
  internalValue.value.splice(index, 1);
  emitUpdate();
};

// 添加项
const addItem = () => {
  // max 保护：不超过最大数量
  if (props.max != null && internalValue.value.length >= props.max) return;
  internalValue.value.push(makeDefaultItem());
  emitUpdate();
};

// 处理图片上传
const handleUpload = async (opts: UploadRequestOptions, index: number, field: FieldConfig) => {
  const file = opts.file as File;
  if (!file.type.startsWith('image/')) {
    ElMessage.error('请选择图片文件');
    return;
  }
  const refKey = `${index}-${field.key}`;
  uploadingKey.value = refKey;
  try {
    const result = await uploadFile(file, field.uploadType || '图片');
    if (internalValue.value[index]) {
      internalValue.value[index][field.key] = result.file_url;
      emitUpdate();
    }
  } catch (e) {
    ElMessage.error((e as Error)?.message || '上传失败');
  } finally {
    uploadingKey.value = null;
  }
};
</script>

<style scoped lang="scss">
.json-list-editor {
  width: 100%;

  .editor-item {
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    gap: 8px;

    &.add-row {
      justify-content: flex-end;
    }
  }
}
</style>
