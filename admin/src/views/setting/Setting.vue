<template>
  <div class="system-settings">
    <el-card shadow="never">
      <!-- 工具栏 -->
      <div class="toolbar">
        <h2>系统设置</h2>
        <div class="actions">
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!canEditSettings"
            @click="handleSave"
          >
            保存配置
          </el-button>
          <el-button @click="loadAllConfigs">重置</el-button>
        </div>
      </div>

      <!-- 标签页 -->
      <el-tabs v-model="activeTab" class="setting-tabs">
        <!-- 基本配置标签页 -->
        <el-tab-pane label="基本配置" name="basic">
          <BasicSettingsTab v-model:form="basicForm" :loading="loading || !canEditSettings" />
        </el-tab-pane>

        <!-- 通知配置标签页 -->
        <el-tab-pane label="通知配置" name="notification">
          <NotificationSettingsTab
            v-model:form="notificationForm"
            :loading="loading || !canEditSettings"
          />
        </el-tab-pane>

        <!-- 上传配置标签页 -->
        <el-tab-pane label="上传配置" name="upload">
          <UploadSettingsTab v-model:form="uploadForm" :loading="loading || !canEditSettings" />
        </el-tab-pane>

        <!-- AI 配置标签页 -->
        <el-tab-pane label="AI 配置" name="ai">
          <AISettingsTab v-model:form="aiForm" :loading="loading || !canEditSettings" />
        </el-tab-pane>

        <!-- OAuth 配置标签页 -->
        <el-tab-pane v-if="isFeatureEnabled('oauth')" label="OAuth 配置" name="oauth">
          <OAuthSettingsTab v-model:form="oauthForm" :loading="loading || !canEditSettings" />
        </el-tab-pane>

        <!-- 导入导出标签页 -->
        <el-tab-pane label="导入导出" name="import-export">
          <ImportExportTab :readonly="!canEditSettings" @import-success="handleImportSuccess" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { getSettingGroup, updateSettingGroup } from '@/api/sysconfig';
import { isSuperAdmin } from '@/utils/auth';
import { useThemeFeatures } from '@/utils/visibility';
import BasicSettingsTab from './components/BasicSettingsTab.vue';
import NotificationSettingsTab from './components/NotificationSettingsTab.vue';
import UploadSettingsTab from './components/UploadSettingsTab.vue';
import AISettingsTab from './components/AISettingsTab.vue';
import OAuthSettingsTab from './components/OAuthSettingsTab.vue';
import ImportExportTab from './components/ImportExportTab.vue';
import type { SettingGroupType } from '@/types/sysconfig';
import type { NotificationForm } from './components/NotificationSettingsTab.vue';
import type { UploadForm } from './components/UploadSettingsTab.vue';

// 页面状态
const activeTab = ref('basic');
const route = useRoute();
const loading = ref(false);
const saving = ref(false);
const canEditSettings = computed(() => isSuperAdmin());
const { isFeatureEnabled } = useThemeFeatures();

// 标签页引用
const basicTabRef = ref<InstanceType<typeof BasicSettingsTab>>();

// 基本配置表单
const basicForm = ref({
  author: '',
  author_avatar: '',
  icp: '',
  police_record: '',
  admin_url: '',
  blog_url: '',
  home_url: '',
  title: '',
  description: '',
  keywords: '',
  favicon: '',
  subtitle: '',
  established: '',
  cravatar_url: '',
  ip_api_url: '',
  cover_maker_api: '',
  meting_api: '',
  custom_head: '',
  custom_body: '',
});

// 通知配置表单
const notificationForm = ref<NotificationForm>({
  email_host: '',
  email_port: '465',
  email_secure: 'ssl',
  email_username: '',
  email_from: '',
  email_password: '',
  feishu_app_id: '',
  feishu_secret: '',
  feishu_chat_id: '',
});

// 上传配置表单
const uploadForm = ref<UploadForm>({
  storage_type: 'local',
  max_file_size: 10,
  path_pattern: '{timestamp}_{random}{ext}',
  access_key: '',
  secret_key: '',
  region: '',
  bucket: '',
  endpoint: '',
  domain: '',
  use_ssl: true,
});

// AI 配置表单
const aiForm = ref({
  base_url: '',
  api_key: '',
  model: '',
  summary_prompt: '',
  ai_summary_prompt: '',
  title_prompt: '',
  mcp_secret: '',
});

// OAuth 配置表单
const oauthForm = ref({
  'github.enabled': 'false',
  'github.client_id': '',
  'github.client_secret': '',
  'github.redirect_url': '',
  'google.enabled': 'false',
  'google.client_id': '',
  'google.client_secret': '',
  'google.redirect_url': '',
  'qq.enabled': 'false',
  'qq.client_id': '',
  'qq.client_secret': '',
  'qq.redirect_url': '',
  'microsoft.enabled': 'false',
  'microsoft.client_id': '',
  'microsoft.client_secret': '',
  'microsoft.redirect_url': '',
  'oidc.enabled': 'false',
  'oidc.issuer_url': '',
  'oidc.client_id': '',
  'oidc.client_secret': '',
  'oidc.redirect_url': '',
  'wechat.enabled': 'false',
  'wechat.appid': '',
  'wechat.secret': '',
  worker_proxy: '',
});

// 加载基本配置
const loadBasicConfigs = async () => {
  try {
    const data = await getSettingGroup('basic');
    Object.assign(basicForm.value, {
      author: data.author || '',
      author_avatar: data.author_avatar || '',
      icp: data.icp || '',
      police_record: data.police_record || '',
      admin_url: data.admin_url || '',
      blog_url: data.blog_url || '',
      home_url: data.home_url || '',
      title: data.title || '',
      description: data.description || '',
      keywords: data.keywords || '',
      favicon: data.favicon || '',
      subtitle: data.subtitle || '',
      established: data.established || '',
      cravatar_url: data.cravatar_url || '',
      ip_api_url: data.ip_api_url || '',
      cover_maker_api: data.cover_maker_api || '',
      meting_api: data.meting_api || '',
      custom_head: data.custom_head || '',
      custom_body: data.custom_body || '',
    });
  } catch {
    ElMessage.error('获取基本配置失败');
  }
};

// 加载通知配置
const loadNotificationConfigs = async () => {
  try {
    const data = await getSettingGroup('notification');
    Object.assign(notificationForm.value, {
      email_host: data.email_host || '',
      email_port: data.email_port || '465',
      email_secure: data.email_secure || 'ssl',
      email_username: data.email_username || '',
      email_from: data.email_from || '',
      email_password: data.email_password || '',
      feishu_app_id: data.feishu_app_id || '',
      feishu_secret: data.feishu_secret || '',
      feishu_chat_id: data.feishu_chat_id || '',
    });
  } catch {
    ElMessage.error('获取通知配置失败');
  }
};

// 加载上传配置
const loadUploadConfigs = async () => {
  try {
    const data = await getSettingGroup('upload');
    Object.assign(uploadForm.value, {
      storage_type: data.storage_type || 'local',
      max_file_size: Number(data.max_file_size || 10),
      path_pattern: data.path_pattern || '{timestamp}_{random}{ext}',
      access_key: data.access_key || '',
      secret_key: data.secret_key || '',
      region: data.region || '',
      bucket: data.bucket || '',
      endpoint: data.endpoint || '',
      domain: data.domain || '',
      use_ssl: (data.use_ssl || 'true') === 'true',
    });
  } catch {
    ElMessage.error('获取上传配置失败');
  }
};

// 加载 AI 配置
const loadAIConfigs = async () => {
  try {
    const data = await getSettingGroup('ai');
    Object.assign(aiForm.value, {
      base_url: data.base_url || '',
      api_key: data.api_key || '',
      model: data.model || '',
      summary_prompt: data.summary_prompt || '',
      ai_summary_prompt: data.ai_summary_prompt || '',
      title_prompt: data.title_prompt || '',
      mcp_secret: data.mcp_secret || '',
    });
  } catch {
    ElMessage.error('获取 AI 配置失败');
  }
};

// 加载 OAuth 配置
const loadOAuthConfigs = async () => {
  try {
    const data = await getSettingGroup('oauth');
    Object.assign(oauthForm.value, {
      'github.enabled': data['github.enabled'] || 'false',
      'github.client_id': data['github.client_id'] || '',
      'github.client_secret': data['github.client_secret'] || '',
      'github.redirect_url': data['github.redirect_url'] || '',
      'google.enabled': data['google.enabled'] || 'false',
      'google.client_id': data['google.client_id'] || '',
      'google.client_secret': data['google.client_secret'] || '',
      'google.redirect_url': data['google.redirect_url'] || '',
      'qq.enabled': data['qq.enabled'] || 'false',
      'qq.client_id': data['qq.client_id'] || '',
      'qq.client_secret': data['qq.client_secret'] || '',
      'qq.redirect_url': data['qq.redirect_url'] || '',
      'microsoft.enabled': data['microsoft.enabled'] || 'false',
      'microsoft.client_id': data['microsoft.client_id'] || '',
      'microsoft.client_secret': data['microsoft.client_secret'] || '',
      'microsoft.redirect_url': data['microsoft.redirect_url'] || '',
      'oidc.enabled': data['oidc.enabled'] || 'false',
      'oidc.issuer_url': data['oidc.issuer_url'] || '',
      'oidc.client_id': data['oidc.client_id'] || '',
      'oidc.client_secret': data['oidc.client_secret'] || '',
      'oidc.redirect_url': data['oidc.redirect_url'] || '',
      'wechat.enabled': data['wechat.enabled'] || 'false',
      'wechat.appid': data['wechat.appid'] || '',
      'wechat.secret': data['wechat.secret'] || '',
      worker_proxy: data.worker_proxy || '',
    });
  } catch {
    ElMessage.error('获取 OAuth 配置失败');
  }
};

// 加载所有配置
const loadAllConfigs = async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadBasicConfigs(),
      loadNotificationConfigs(),
      loadUploadConfigs(),
      loadAIConfigs(),
      loadOAuthConfigs(),
    ]);
  } finally {
    loading.value = false;
  }
};

// 统一保存配置
const handleSave = async () => {
  if (!canEditSettings.value) {
    ElMessage.warning('仅超级管理员可修改系统配置');
    return;
  }

  saving.value = true;
  try {
    const uploadPromises: Promise<void>[] = [];

    // 收集所有待上传的图片（并行上传）
    const uploaders = basicTabRef.value;
    if (uploaders?.authorAvatarUploaderRef?.getPendingCount()) {
      uploadPromises.push(
        uploaders.authorAvatarUploaderRef.uploadPendingFile().then(url => {
          if (url) basicForm.value.author_avatar = url;
        })
      );
    }

    if (uploaders?.faviconUploaderRef?.getPendingCount()) {
      uploadPromises.push(
        uploaders.faviconUploaderRef.uploadPendingFile().then(url => {
          if (url) basicForm.value.favicon = url;
        })
      );
    }

    // 等待所有上传完成（使用 allSettled 确保即使部分失败也继续）
    if (uploadPromises.length > 0) {
      const results = await Promise.allSettled(uploadPromises);
      const failedUploads = results.filter(r => r.status === 'rejected');
      if (failedUploads.length > 0) {
        saving.value = false;
        ElMessage.error(`${failedUploads.length} 个文件上传失败，请重试`);
        return;
      }
    }

    // 基本配置
    const basicPayload: Record<string, string> = {
      author: basicForm.value.author,
      author_avatar: basicForm.value.author_avatar,
      icp: basicForm.value.icp,
      police_record: basicForm.value.police_record,
      admin_url: basicForm.value.admin_url,
      blog_url: basicForm.value.blog_url,
      home_url: basicForm.value.home_url,
      title: basicForm.value.title,
      description: basicForm.value.description,
      keywords: basicForm.value.keywords,
      favicon: basicForm.value.favicon,
      subtitle: basicForm.value.subtitle,
      established: basicForm.value.established,
      cravatar_url: basicForm.value.cravatar_url,
      ip_api_url: basicForm.value.ip_api_url,
      cover_maker_api: basicForm.value.cover_maker_api,
      meting_api: basicForm.value.meting_api,
    };

    // 通知配置
    const notificationPayload: Record<string, string> = {
      email_host: notificationForm.value.email_host,
      email_port: String(notificationForm.value.email_port),
      email_secure: notificationForm.value.email_secure,
      email_username: notificationForm.value.email_username,
      email_from: notificationForm.value.email_from,
      email_password: notificationForm.value.email_password,
      feishu_app_id: notificationForm.value.feishu_app_id,
      feishu_secret: notificationForm.value.feishu_secret,
      feishu_chat_id: notificationForm.value.feishu_chat_id,
    };

    // 上传配置
    const uploadPayload: Record<string, string> = {
      storage_type: uploadForm.value.storage_type,
      max_file_size: String(uploadForm.value.max_file_size),
      path_pattern: uploadForm.value.path_pattern,
      access_key: uploadForm.value.access_key,
      secret_key: uploadForm.value.secret_key,
      region: uploadForm.value.region,
      bucket: uploadForm.value.bucket,
      endpoint: uploadForm.value.endpoint,
      domain: uploadForm.value.domain,
      use_ssl: uploadForm.value.use_ssl ? 'true' : 'false',
    };

    // AI 配置
    const aiPayload: Record<string, string> = {
      base_url: aiForm.value.base_url,
      api_key: aiForm.value.api_key,
      model: aiForm.value.model,
      summary_prompt: aiForm.value.summary_prompt,
      ai_summary_prompt: aiForm.value.ai_summary_prompt,
      title_prompt: aiForm.value.title_prompt,
    };

    // OAuth 配置
    const oauthPayload: Record<string, string> = {
      'github.enabled': oauthForm.value['github.enabled'],
      'github.client_id': oauthForm.value['github.client_id'],
      'github.client_secret': oauthForm.value['github.client_secret'],
      'github.redirect_url': oauthForm.value['github.redirect_url'],
      'google.enabled': oauthForm.value['google.enabled'],
      'google.client_id': oauthForm.value['google.client_id'],
      'google.client_secret': oauthForm.value['google.client_secret'],
      'google.redirect_url': oauthForm.value['google.redirect_url'],
      'qq.enabled': oauthForm.value['qq.enabled'],
      'qq.client_id': oauthForm.value['qq.client_id'],
      'qq.client_secret': oauthForm.value['qq.client_secret'],
      'qq.redirect_url': oauthForm.value['qq.redirect_url'],
      'microsoft.enabled': oauthForm.value['microsoft.enabled'],
      'microsoft.client_id': oauthForm.value['microsoft.client_id'],
      'microsoft.client_secret': oauthForm.value['microsoft.client_secret'],
      'microsoft.redirect_url': oauthForm.value['microsoft.redirect_url'],
      'oidc.enabled': oauthForm.value['oidc.enabled'],
      'oidc.issuer_url': oauthForm.value['oidc.issuer_url'],
      'oidc.client_id': oauthForm.value['oidc.client_id'],
      'oidc.client_secret': oauthForm.value['oidc.client_secret'],
      'oidc.redirect_url': oauthForm.value['oidc.redirect_url'],
      'wechat.enabled': oauthForm.value['wechat.enabled'],
      'wechat.appid': oauthForm.value['wechat.appid'],
      'wechat.secret': oauthForm.value['wechat.secret'],
      worker_proxy: oauthForm.value['worker_proxy'],
    };

    // 构建需要保存的配置组列表
    const savePromises = [
      updateSettingGroup('basic', basicPayload),
      updateSettingGroup('notification', notificationPayload),
      updateSettingGroup('upload', uploadPayload),
      updateSettingGroup('ai', aiPayload),
      updateSettingGroup('oauth', oauthPayload),
    ];

    // 并行保存所有配置组
    await Promise.all(savePromises);

    ElMessage.success('配置保存成功');
  } catch (e) {
    if (e instanceof Error) ElMessage.error(e.message);
    else ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const validTabs = new Set<SettingGroupType | 'import-export'>([
  'basic',
  'notification',
  'upload',
  'ai',
  'oauth',
  'import-export',
]);

watch(
  () => route.query.tab,
  tab => {
    if (typeof tab === 'string' && validTabs.has(tab as SettingGroupType | 'import-export')) {
      activeTab.value = tab;
    }
  },
  { immediate: true }
);

// 导入成功回调
const handleImportSuccess = () => {
  // 可以在这里添加导入成功后的逻辑
};

onMounted(() => {
  loadAllConfigs();
});
</script>

<style lang="scss" scoped>
.system-settings {
  height: 100%;

  :deep(.el-card) {
    height: 100%;
    display: flex;
    flex-direction: column;

    .el-card__body {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
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

.setting-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  :deep(.el-tabs__header) {
    margin: 0 0 12px 0;
    flex-shrink: 0;
  }

  :deep(.el-tabs__nav-wrap) {
    justify-content: center;

    &::after {
      display: none;
    }
  }

  :deep(.el-tabs__nav) {
    float: none;
  }

  :deep(.el-tabs__content) {
    flex: 1;
    overflow: hidden;
  }

  :deep(.el-tab-pane) {
    height: 100%;
    overflow-y: auto;
    padding: 0 16px;

    .setting-form {
      max-width: 95%;
      margin: 0 auto;
    }
  }
}

// 移动端适配
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;

    h2 {
      font-size: 18px;
    }

    .actions {
      width: 100%;

      .el-button {
        flex: 1;
      }
    }
  }

  .setting-tabs {
    :deep(.el-tabs__nav-wrap) {
      justify-content: flex-start;
    }

    :deep(.el-tabs__nav-scroll) {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }
    }

    :deep(.el-tabs__nav-wrap.is-scrollable) {
      padding: 0;
    }

    :deep(.el-tab-pane) {
      padding: 0 8px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;

      &::-webkit-scrollbar {
        display: none;
      }

      .setting-form {
        max-width: none;
        min-width: 800px;
      }
    }
  }

  :deep(.el-form-item__label) {
    width: 120px !important;
    flex-shrink: 0;
  }
}
</style>
