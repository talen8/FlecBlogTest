<template>
  <div class="menu-management">
    <template v-if="menuSlots.length > 0">
      <div class="menu-toolbar">
        <el-segmented
          v-model="selectedMenuType"
          :options="menuTypeOptions"
          @change="handleMenuTypeChange"
        />
        <el-button type="primary" size="small" @click="handleCreateMenu"> 新增菜单 </el-button>
      </div>

      <el-table
        v-loading="menuLoading"
        :data="menuTree"
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        default-expand-all
        style="margin-top: 12px"
      >
        <el-table-column label="菜单标题" min-width="200">
          <template #default="{ row }">
            <div class="menu-title">
              <i
                v-if="row.icon && row.icon.startsWith('ri-')"
                :class="row.icon"
                class="menu-icon"
              ></i>
              <img v-else-if="row.icon" :src="row.icon" class="menu-icon-img" alt="icon" />
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="链接地址" min-width="250">
          <template #default="{ row }">
            <span v-if="row.url">{{ row.url }}</span>
            <span v-else style="color: #999">-</span>
          </template>
        </el-table-column>

        <el-table-column prop="sort" label="排序" width="100" align="center" />

        <el-table-column label="操作" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="handleAddChildMenu(row)">
              新增子菜单
            </el-button>
            <el-button type="primary" link size="small" @click="handleEditMenu(row)">
              编辑
            </el-button>
            <el-button type="danger" link size="small" @click="handleDeleteMenu(row.id)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>

    <el-empty v-else description="当前主题未声明菜单槽位" :image-size="60" />

    <!-- 菜单表单弹窗 -->
    <el-dialog
      v-model="menuDialogVisible"
      :title="isMenuEdit ? '编辑菜单' : '新增菜单'"
      width="90%"
      style="max-width: 600px"
      :close-on-click-modal="false"
      @close="handleFormClose"
    >
      <el-form ref="menuFormRef" :model="menuFormData" :rules="menuFormRules" label-width="100px">
        <div class="form-info">
          <div class="info-item">
            <span class="info-label">菜单类型</span>
            <span class="info-value">{{ getMenuTypeLabel(selectedMenuType) }}</span>
          </div>
          <div v-if="parentMenu && !isMenuEdit" class="info-item">
            <span class="info-label">父菜单</span>
            <span class="info-value">{{ parentMenu.title }}</span>
          </div>
        </div>

        <el-form-item label="菜单标题" prop="title">
          <el-input
            v-model="menuFormData.title"
            placeholder="请输入菜单标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="链接地址" prop="url">
          <el-input
            v-model="menuFormData.url"
            placeholder="请输入链接地址"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="图标" prop="icon">
          <div class="icon-input-wrapper">
            <el-input
              v-model="menuFormData.icon"
              placeholder="请输入图标类名(ri-home-line)或上传图片"
              maxlength="500"
            >
              <template #append>
                <el-button @click="handleIconUpload">
                  <el-icon><Upload /></el-icon>
                  上传
                </el-button>
              </template>
            </el-input>
            <div v-if="menuFormData.icon" class="icon-preview">
              <i v-if="isRemixIcon(menuFormData.icon)" :class="menuFormData.icon"></i>
              <img v-else :src="menuFormData.icon" alt="图标预览" @error="handleIconError" />
            </div>
          </div>
        </el-form-item>

        <el-form-item label="排序" prop="sort">
          <el-input-number v-model="menuFormData.sort" :min="1" :max="999" />
        </el-form-item>

        <el-form-item label="是否启用" prop="is_enabled">
          <el-switch v-model="menuFormData.is_enabled" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="handleFormClose">取消</el-button>
        <el-button type="primary" :loading="menuFormLoading" @click="handleFormSubmit">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import type { FormInstance, FormRules } from 'element-plus';
import { getThemeMenus, updateThemeMenus } from '@/api/theme';
import type { MenuSlot, MenuDataItem } from '@/types/theme';
import { uploadFile } from '@/api/file';

const props = defineProps<{
  activeSlug: string;
  menuSlots: MenuSlot[];
  themeName: string;
}>();

// ============ 菜单列表 ============

const selectedMenuType = ref('');
const menuTree = ref<MenuDataItem[]>([]);
const menuLoading = ref(false);
const menuDialogVisible = ref(false);
const currentMenu = ref<MenuDataItem | null>(null);
const parentMenu = ref<MenuDataItem | null>(null);

const menuTypeOptions = computed(() =>
  props.menuSlots.map(slot => ({ label: slot.label, value: slot.key }))
);

const getMenuTypeLabel = (type: string) => {
  const slot = props.menuSlots.find(s => s.key === type);
  return slot?.label || type;
};

const initMenuType = () => {
  if (props.menuSlots.length > 0 && !selectedMenuType.value) {
    selectedMenuType.value = props.menuSlots[0]!.key;
    fetchMenuTree();
  }
};

const handleMenuTypeChange = () => {
  fetchMenuTree();
};

const fetchMenuTree = async () => {
  if (!selectedMenuType.value || !props.activeSlug) return;
  menuLoading.value = true;
  try {
    menuTree.value = await getThemeMenus(props.activeSlug, selectedMenuType.value);
  } catch {
    ElMessage.error('获取菜单列表失败');
  } finally {
    menuLoading.value = false;
  }
};

const saveMenuTree = async (items: MenuDataItem[]) => {
  if (!props.activeSlug || !selectedMenuType.value) return;
  await updateThemeMenus(props.activeSlug, { type: selectedMenuType.value, items });
  await fetchMenuTree();
};

const handleCreateMenu = () => {
  currentMenu.value = null;
  parentMenu.value = null;
  menuDialogVisible.value = true;
};

const handleAddChildMenu = (menu: MenuDataItem) => {
  currentMenu.value = null;
  parentMenu.value = menu;
  menuDialogVisible.value = true;
};

const handleEditMenu = (menu: MenuDataItem) => {
  currentMenu.value = menu;
  parentMenu.value = null;
  for (const root of menuTree.value) {
    if (root.children?.some(c => c.id === menu.id)) {
      parentMenu.value = root;
      break;
    }
  }
  menuDialogVisible.value = true;
};

const removeFromTree = (nodes: MenuDataItem[], id: number): boolean => {
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i]!.id === id) {
      nodes.splice(i, 1);
      return true;
    }
    if (nodes[i]!.children?.length && removeFromTree(nodes[i]!.children, id)) {
      return true;
    }
  }
  return false;
};

const findInTree = (nodes: MenuDataItem[], id: number): MenuDataItem | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const found = findInTree(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const handleDeleteMenu = async (id: number) => {
  try {
    const node = findInTree(menuTree.value, id);
    const hasChildren = node?.children && node.children.length > 0;

    if (hasChildren) {
      await ElMessageBox.confirm(`包含 ${node.children!.length} 个子菜单，将一并删除。`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      });
    } else {
      await ElMessageBox.confirm('确定要删除此菜单吗？', '提示', { type: 'warning' });
    }

    const tree = JSON.parse(JSON.stringify(menuTree.value)) as MenuDataItem[];
    removeFromTree(tree, id);
    await saveMenuTree(tree);
    ElMessage.success('删除成功');
  } catch (error) {
    if (error !== 'cancel' && error !== 'close' && error instanceof Error) {
      ElMessage.error(error.message);
    }
  }
};

// ============ 菜单表单 ============

const menuFormRef = ref<FormInstance>();
const menuFormLoading = ref(false);
const isMenuEdit = computed(() => !!currentMenu.value);

interface IconItem {
  type: 'file' | 'url';
  file?: File;
  url: string;
}
const iconItem = ref<IconItem | null>(null);

const menuFormData = ref({
  title: '',
  url: '',
  icon: '',
  sort: 5,
  is_enabled: true,
});

const menuFormRules: FormRules = {
  title: [
    { message: '请输入菜单标题', trigger: 'blur' },
    { min: 1, max: 100, message: '长度在 1 到 100 个字符', trigger: 'blur' },
  ],
  url: [{ max: 500, message: '链接地址不能超过 500 个字符', trigger: 'blur' }],
  icon: [{ max: 500, message: '图标不能超过 500 个字符', trigger: 'blur' }],
};

const isRemixIcon = (icon: string) => icon && icon.startsWith('ri-');

const cleanupIconBlob = () => {
  if (iconItem.value?.type === 'file' && iconItem.value.url.startsWith('blob:')) {
    URL.revokeObjectURL(iconItem.value.url);
  }
};

const handleIconUpload = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = e => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    cleanupIconBlob();
    const blobUrl = URL.createObjectURL(file);
    iconItem.value = { type: 'file', file, url: blobUrl };
    menuFormData.value.icon = blobUrl;
  };
  input.click();
};

const handleIconError = (e: Event) => {
  const target = e.target as HTMLImageElement;
  target.style.display = 'none';
  ElMessage.warning('图标加载失败');
};

const initFormData = () => {
  cleanupIconBlob();
  iconItem.value = null;

  if (currentMenu.value) {
    const menu = currentMenu.value;
    menuFormData.value = {
      title: menu.title,
      url: menu.url || '',
      icon: menu.icon || '',
      sort: menu.sort || 0,
      is_enabled: menu.is_enabled,
    };
    if (menu.icon) {
      iconItem.value = { type: 'url', url: menu.icon };
    }
  } else {
    menuFormData.value = { title: '', url: '', icon: '', sort: 5, is_enabled: true };
  }
};

const handleFormSubmit = async () => {
  if (!menuFormRef.value) return;

  try {
    await menuFormRef.value.validate();
    menuFormLoading.value = true;

    if (iconItem.value?.type === 'file' && iconItem.value.file) {
      const result = await uploadFile(iconItem.value.file, props.themeName || '菜单图标');
      menuFormData.value.icon = result.file_url;
    }

    const tree = JSON.parse(JSON.stringify(menuTree.value)) as MenuDataItem[];

    if (isMenuEdit.value && currentMenu.value) {
      const replaceInTree = (nodes: MenuDataItem[]): boolean => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i]!.id === currentMenu.value!.id) {
            nodes[i] = {
              ...currentMenu.value!,
              title: menuFormData.value.title,
              url: menuFormData.value.url,
              icon: menuFormData.value.icon,
              sort: menuFormData.value.sort,
              is_enabled: menuFormData.value.is_enabled,
            };
            return true;
          }
          if (nodes[i]!.children?.length && replaceInTree(nodes[i]!.children)) {
            return true;
          }
        }
        return false;
      };
      replaceInTree(tree);
    } else {
      const newItem: MenuDataItem = {
        id: 0,
        title: menuFormData.value.title,
        url: menuFormData.value.url,
        icon: menuFormData.value.icon,
        sort: menuFormData.value.sort,
        is_enabled: menuFormData.value.is_enabled,
        children: [],
      };
      if (parentMenu.value) {
        const parent = findInTree(tree, parentMenu.value.id);
        if (parent) {
          if (!parent.children) parent.children = [];
          parent.children.push(newItem);
        }
      } else {
        tree.push(newItem);
      }
    }

    await saveMenuTree(tree);
    ElMessage.success(isMenuEdit.value ? '更新成功' : '创建成功');
    handleFormClose();
  } catch (error) {
    if (error instanceof Error) {
      ElMessage.error(error.message || '操作失败');
    }
  } finally {
    menuFormLoading.value = false;
  }
};

const handleFormClose = () => {
  cleanupIconBlob();
  iconItem.value = null;
  menuFormRef.value?.clearValidate();
  menuDialogVisible.value = false;
};

// 弹窗打开时初始化表单
watch(menuDialogVisible, val => {
  if (val) initFormData();
});

defineExpose({ refresh: fetchMenuTree, initMenuType });
</script>

<style lang="scss" scoped>
.menu-management {
  height: 100%;
}

.menu-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.menu-title {
  display: inline-flex;
  align-items: center;

  .menu-icon {
    margin-right: 8px;
    font-size: 16px;
    color: #606266;
  }

  .menu-icon-img {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    object-fit: contain;
    vertical-align: middle;
  }
}

.form-info {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 16px;
  margin-bottom: 20px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #e4e7ed;

  .info-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    flex: 1;
    text-align: center;

    .info-label {
      font-size: 12px;
      color: #909399;
    }

    .info-value {
      font-size: 14px;
      color: #303133;
      font-weight: 500;
    }
  }
}

.icon-input-wrapper {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;

  .el-input {
    flex: 1;
  }

  .icon-preview {
    width: 40px;
    height: 40px;
    border: 1px solid #e4e7ed;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f5f7fa;
    flex-shrink: 0;

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }

    i {
      font-size: 24px;
      color: #606266;
    }
  }
}
</style>
