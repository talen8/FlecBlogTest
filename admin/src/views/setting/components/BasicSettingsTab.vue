<template>
  <el-form :model="form" label-width="120px" class="setting-form">
    <el-divider content-position="left">网站信息</el-divider>

    <el-form-item label="网站标题">
      <el-input
        v-model="form.title"
        placeholder="用于RSS订阅和邮件显示的站点标题"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="网站副标题">
      <el-input v-model="form.subtitle" placeholder="网站副标题" :disabled="loading" />
    </el-form-item>

    <el-form-item label="网站描述">
      <el-input
        v-model="form.description"
        type="textarea"
        :rows="3"
        placeholder="网站描述，用于SEO"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="关键词">
      <el-input
        v-model="form.keywords"
        placeholder="网站关键词，多个用逗号分隔"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="Favicon">
      <ImageUploader
        ref="faviconUploaderRef"
        v-model="form.favicon"
        upload-type="博客图标"
        width="120px"
        height="120px"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="建站日期">
      <el-date-picker
        v-model="form.established"
        type="date"
        placeholder="选择建站日期"
        value-format="YYYY-MM-DD"
        :disabled="loading"
      />
    </el-form-item>

    <el-divider content-position="left">站长信息</el-divider>

    <el-form-item label="站长姓名">
      <el-input v-model="form.author" placeholder="站长姓名" :disabled="loading" />
    </el-form-item>

    <div class="image-row">
      <el-form-item label="站长头像">
        <ImageUploader
          ref="authorAvatarUploaderRef"
          v-model="form.author_avatar"
          upload-type="站长头像"
          width="120px"
          height="120px"
          :disabled="loading"
        />
      </el-form-item>
    </div>

    <el-divider content-position="left">第三方服务</el-divider>

    <el-form-item label="头像服务">
      <el-input
        v-model="form.cravatar_url"
        placeholder="头像服务 URL，%s 为邮箱哈希，如 https://cravatar.cn/avatar/%s?s=200&d=robohash"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="IP 查询">
      <el-input
        v-model="form.ip_api_url"
        placeholder="IP 归属地查询 URL，%s 为 IP，如 http://ip-api.com/json/%s?lang=zh-CN"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="封面制作">
      <el-input
        v-model="form.cover_maker_api"
        placeholder="封面制作图片源 API，如 https://pixhub.flec.top"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="Meting-API">
      <el-input
        v-model="form.meting_api"
        placeholder="Meting-API 地址，如 https://meting.flec.top/api"
        :disabled="loading"
      />
    </el-form-item>

    <el-divider content-position="left">备案信息</el-divider>

    <el-form-item label="ICP备案号">
      <el-input v-model="form.icp" placeholder="ICP备案号" :disabled="loading" />
    </el-form-item>

    <el-form-item label="公安备案号">
      <el-input v-model="form.police_record" placeholder="公安备案号" :disabled="loading" />
    </el-form-item>

    <el-divider content-position="left">系统地址</el-divider>

    <el-form-item label="管理地址">
      <el-input
        v-model="form.admin_url"
        placeholder="例如 https://admin.your-site.com"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="博客地址">
      <el-input
        v-model="form.blog_url"
        placeholder="例如 https://blog.your-site.com"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="主页地址">
      <el-input
        v-model="form.home_url"
        placeholder="例如 https://your-site.com"
        :disabled="loading"
      />
    </el-form-item>

    <el-divider content-position="left">自定义代码</el-divider>

    <el-form-item label="自定义 Head">
      <el-input
        v-model="form.custom_head"
        type="textarea"
        :rows="4"
        placeholder="插入到 &lt;/head&gt; 之前的 HTML 代码"
        :disabled="loading"
      />
    </el-form-item>

    <el-form-item label="自定义 Body">
      <el-input
        v-model="form.custom_body"
        type="textarea"
        :rows="4"
        placeholder="插入到 &lt;body&gt; 开头的 HTML 代码"
        :disabled="loading"
      />
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import ImageUploader from '@/components/common/ImageUploader.vue';

interface BasicForm {
  author: string;
  author_avatar: string;
  icp: string;
  police_record: string;
  admin_url: string;
  blog_url: string;
  home_url: string;
  title: string;
  description: string;
  keywords: string;
  favicon: string;
  subtitle: string;
  established: string;
  cravatar_url: string;
  ip_api_url: string;
  cover_maker_api: string;
  meting_api: string;
  custom_head: string;
  custom_body: string;
}

const form = defineModel<BasicForm>('form', { required: true });

defineProps<{
  loading?: boolean;
}>();

const authorAvatarUploaderRef = ref<InstanceType<typeof ImageUploader>>();
const faviconUploaderRef = ref<InstanceType<typeof ImageUploader>>();

defineExpose({
  authorAvatarUploaderRef,
  faviconUploaderRef,
});
</script>

<style lang="scss" scoped>
.setting-form {
  .image-row {
    display: flex;
    gap: 40px;

    .el-form-item {
      margin-bottom: 22px;
    }
  }
}

@media (max-width: 768px) {
  .setting-form {
    .image-row {
      flex-direction: column;
      gap: 0;
    }
  }

  :deep(.el-form-item__label) {
    width: 100px !important;
    font-size: 13px;
  }
}
</style>
