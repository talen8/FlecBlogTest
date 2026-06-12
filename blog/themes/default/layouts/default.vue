<script lang="ts" setup>
const route = useRoute();
const showSidebar = computed(() => (route.meta.showSidebar as boolean | undefined) ?? true);
const showMomentWidget = computed(() => route.path == '/');

// 背景图片
const { getString } = useTheme();
const bgImage = computed(() => getString('background_image', '/bg.webp'));

// Toast、登录弹窗、邮箱绑定弹窗
const { toasts } = useToast();
const { showLoginModal } = useLoginModal();
const { showBindEmailModal, triggerGlobal, onBindSuccess } = useBindEmail();

// 全局路由切换时触发邮箱绑定提示
const router = useRouter();
router.afterEach(() => {
  triggerGlobal();
});
</script>

<template>
  <!-- 背景图片 -->
  <div class="web_bg" :style="{ backgroundImage: `url(${bgImage})` }" />

  <div class="layout-wrapper">
    <LayoutsNavbar />
    <LayoutsHeader />
    <main class="page-main">
      <FeaturesMomentWidget v-if="showMomentWidget" />
      <div class="main-layout">
        <div class="main-content" :class="!showSidebar ? 'full-width' : ''">
          <slot />
        </div>
        <LayoutsSidebar v-if="showSidebar" />
      </div>
    </main>
    <LayoutsFooter />
    <UiFloatButton />

    <!-- Toast 消息提示 -->
    <UiToast
      v-for="toast in toasts"
      :key="toast.id"
      :message="toast.message"
      :type="toast.type"
      :show="toast.show"
    />

    <!-- 登录弹窗 -->
    <FeaturesModalsLoginModal v-model="showLoginModal" />

    <!-- 邮箱绑定弹窗 -->
    <FeaturesModalsBindEmailModal v-model="showBindEmailModal" @success="onBindSuccess" />

    <!-- 右键菜单 -->
    <UiContextMenu />
  </div>
</template>

<style lang="scss" scoped>
.web_bg {
  position: fixed;
  width: 100%;
  height: 100%;
  z-index: -50;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}

[data-theme='dark'] .web_bg::before {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: #121212b0;
  content: '';
}

.layout-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-main {
  background: var(--flec-page-bg);
  width: 100%;
  padding: 40px 0;
  flex: 1;

  .main-layout {
    position: relative;
    display: flex;
    flex: 1 auto;
    margin: 0 auto;
    padding: 0 15px;
    max-width: 1200px;
    width: 100%;

    .main-content {
      width: 74%;
      transition: width 0.3s ease;

      &.full-width {
        width: 100%;
      }
    }
  }
}

// 响应式设计
@media screen and (max-width: 900px) {
  .page-main {
    .main-layout {
      flex-direction: column;
      padding: 0 12px;

      .main-content {
        width: 100%;
      }
    }
  }
}
</style>
