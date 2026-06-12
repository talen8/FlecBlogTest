<template>
  <el-descriptions :column="1" border>
    <el-descriptions-item label="主题名">{{
      themeDetail.name || themeDetail.slug
    }}</el-descriptions-item>
    <el-descriptions-item label="标识">{{ themeDetail.slug }}</el-descriptions-item>
    <el-descriptions-item label="版本">v{{ themeDetail.version }}</el-descriptions-item>
    <el-descriptions-item label="作者">{{ themeDetail.author || '未知' }}</el-descriptions-item>
    <el-descriptions-item label="描述" :span="2">{{
      themeDetail.description || '暂无描述'
    }}</el-descriptions-item>
    <el-descriptions-item v-if="themeDetail.cover" label="封面" :span="2">
      <el-image
        :src="themeDetail.cover"
        style="max-width: 300px; max-height: 180px"
        fit="cover"
        :preview-src-list="[themeDetail.cover]"
      />
    </el-descriptions-item>
    <el-descriptions-item label="开源协议">{{ themeDetail.license || '-' }}</el-descriptions-item>
    <el-descriptions-item label="仓库">
      <a
        v-if="themeDetail.repo"
        :href="themeDetail.repo"
        target="_blank"
        style="color: var(--el-color-primary)"
        >{{ themeDetail.repo }}</a
      >
      <span v-else>-</span>
    </el-descriptions-item>
    <el-descriptions-item label="安装时间">{{ themeDetail.created_at }}</el-descriptions-item>
    <el-descriptions-item label="更新时间">{{ themeDetail.updated_at }}</el-descriptions-item>
  </el-descriptions>

  <template v-if="featureList.length > 0">
    <div class="features-section">
      <h4>功能支持</h4>
      <div class="features-grid">
        <div
          v-for="item in featureList"
          :key="item.key"
          class="feature-item"
          :class="{ disabled: !item.enabled }"
        >
          <div class="feature-icon">
            <i :class="item.icon"></i>
          </div>
          <div class="feature-info">
            <span class="feature-label">{{ item.label }}</span>
            <span class="feature-status">
              <i :class="item.enabled ? 'ri-check-line' : 'ri-close-line'"></i>
              {{ item.enabled ? '已启用' : '未启用' }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Theme } from '@/types/theme';

const FEATURE_LABELS: Record<string, { label: string; icon: string }> = {
  moments: { label: '动态', icon: 'ri-chat-3-line' },
  feedback: { label: '反馈投诉', icon: 'ri-feedback-line' },
  oauth: { label: 'OAuth 配置', icon: 'ri-shield-keyhole-line' },
  site_subscribe: { label: '本站订阅', icon: 'ri-mail-send-line' },
};

const props = defineProps<{
  themeDetail: Theme;
}>();

const featureList = computed(() => {
  const raw = (props.themeDetail.schema as Record<string, unknown>)?.['$features'];
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw as Record<string, unknown>)
    .filter(([k]) => !k.startsWith('$'))
    .map(([k, v]) => ({
      key: k,
      label: FEATURE_LABELS[k]?.label || k,
      icon: FEATURE_LABELS[k]?.icon || 'ri-checkbox-circle-line',
      enabled: v !== false,
    }));
});
</script>

<style lang="scss" scoped>
.features-section {
  margin-top: 24px;

  h4 {
    margin: 0 0 16px;
    font-size: 15px;
    font-weight: 500;
    color: #303133;
  }
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
  background: #fff;

  &.disabled {
    opacity: 0.5;
  }

  .feature-icon {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f7fa;
    color: #606266;
    flex-shrink: 0;

    i {
      font-size: 16px;
    }
  }

  .feature-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;

    .feature-label {
      font-size: 14px;
      color: #303133;
    }

    .feature-status {
      font-size: 12px;
      color: #909399;
      display: flex;
      align-items: center;
      gap: 2px;

      i {
        font-size: 13px;
      }
    }
  }
}
</style>
