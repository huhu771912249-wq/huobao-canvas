<template>
  <div class="workspace-shell workspace-atmosphere">
    <aside class="workspace-sidebar workspace-panel" aria-label="主导航">
      <button type="button" class="workspace-brand" aria-label="冠希无限画布首页" @click="emitNavigate(navigation[0])">
        <img src="../../assets/logo.png" alt="" />
      </button>
      <nav>
        <button
          v-for="item in navigation"
          :key="item.id"
          type="button"
          class="nav-item"
          :class="{ 'nav-item--active': item.id === activeSection }"
          :aria-label="item.label"
          :title="item.label"
          @click="emitNavigate(item)"
        >
          <n-icon :size="20"><component :is="iconFor(item.id)" /></n-icon>
          <span>{{ item.label }}</span>
        </button>
      </nav>
    </aside>

    <section class="workspace-stage">
      <header class="workspace-topbar">
        <div class="workspace-topbar__title">
          <span class="workspace-topbar__product">冠希无限画布</span>
          <strong>{{ projectTitle || '创作工作台' }}</strong>
        </div>
        <div class="workspace-topbar__actions">
          <ComputeStatusIndicator />
          <ServiceStatusPill
            :label="serviceStatus.label"
            :tone="serviceStatus.tone"
            @click="$emit('open-status')"
          />
          <button type="button" class="topbar-button" aria-label="打开任务中心" @click="$emit('open-tasks')">
            <n-icon :size="19"><PulseOutline /></n-icon>
            <span>任务</span>
          </button>
          <button type="button" class="topbar-button" aria-label="打开 API 设置" @click="$emit('open-settings')">
            <n-icon :size="19"><SettingsOutline /></n-icon>
          </button>
        </div>
      </header>

      <main class="workspace-main">
        <slot name="main"></slot>
      </main>
    </section>

    <slot name="inspector"></slot>

    <nav class="workspace-bottom-nav workspace-panel" aria-label="移动端主导航">
      <button
        v-for="item in mobileNavigation"
        :key="item.id"
        type="button"
        :class="{ 'nav-item--active': item.id === activeSection }"
        @click="emitNavigate(item)"
      >
        <n-icon :size="20"><component :is="iconFor(item.id)" /></n-icon>
        <span>{{ item.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { NIcon } from 'naive-ui'
import {
  AlbumsOutline,
  ColorPaletteOutline,
  FolderOpenOutline,
  GridOutline,
  HomeOutline,
  ImagesOutline,
  PulseOutline,
  SettingsOutline,
  SparklesOutline,
  VideocamOutline
} from '@vicons/ionicons5'
import { buildWorkspaceNavigation } from '../../utils/workspaceUi'
import ServiceStatusPill from './ServiceStatusPill.vue'
import ComputeStatusIndicator from '../ComputeStatusIndicator.vue'

defineProps({
  activeSection: {
    type: String,
    default: 'home'
  },
  projectTitle: {
    type: String,
    default: ''
  },
  serviceStatus: {
    type: Object,
    default: () => ({ label: '服务正常', tone: 'success' })
  }
})

const emit = defineEmits(['navigate', 'open-settings', 'open-status', 'open-tasks'])
const navigation = buildWorkspaceNavigation()
const mobileNavigation = computed(() => navigation.filter((item) => ['home', 'recent', 'variation', 'tasks'].includes(item.id)))

const icons = {
  home: HomeOutline,
  image: ImagesOutline,
  video: VideocamOutline,
  variation: SparklesOutline,
  dsp: GridOutline,
  recent: AlbumsOutline,
  tasks: PulseOutline,
  projects: FolderOpenOutline,
  albums: AlbumsOutline,
  palette: ColorPaletteOutline
}

const iconFor = (id) => icons[id] || HomeOutline
const emitNavigate = (item) => emit('navigate', item)
</script>

<style scoped>
.workspace-shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 100px minmax(0, 1fr);
  color: var(--text-primary);
  overflow: hidden;
}

.workspace-sidebar {
  z-index: 30;
  margin: 12px;
  padding: 12px 8px;
  border-radius: 24px;
}

.workspace-brand {
  width: 48px;
  height: 48px;
  margin: 2px auto 16px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: linear-gradient(145deg, rgba(101, 230, 189, 0.18), rgba(110, 168, 255, 0.15));
}

.workspace-brand img {
  width: 34px;
  height: 34px;
}

.workspace-sidebar nav {
  display: grid;
  gap: 6px;
}

.nav-item {
  position: relative;
  width: 60px;
  min-height: 52px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  color: var(--text-secondary);
  transition: color 180ms ease, background 180ms ease, transform 180ms ease;
}

.nav-item span {
  position: absolute;
  left: 66px;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  color: var(--text-primary);
  background: var(--panel-strong);
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transform: translateX(-6px);
  transition: opacity 160ms ease, transform 160ms ease;
  white-space: nowrap;
}

.nav-item:hover span {
  opacity: 1;
  transform: translateX(0);
}

.nav-item:hover,
.nav-item--active {
  color: var(--text-primary);
  background: rgba(101, 230, 189, 0.1);
}

.nav-item--active::before {
  content: "";
  position: absolute;
  left: -8px;
  width: 3px;
  height: 22px;
  border-radius: 99px;
  background: var(--accent-color);
  box-shadow: 0 0 14px rgba(101, 230, 189, 0.65);
}

.workspace-stage {
  min-width: 0;
  height: 100vh;
  overflow: auto;
}

.workspace-topbar {
  position: sticky;
  z-index: 20;
  top: 0;
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border-color);
  background: rgba(8, 11, 18, 0.78);
  backdrop-filter: blur(20px);
}

.workspace-topbar__title {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.workspace-topbar__product {
  color: var(--text-secondary);
  font-size: 12px;
}

.workspace-topbar__title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace-topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.topbar-button {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 11px;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.035);
}

.topbar-button:hover {
  color: var(--text-primary);
  border-color: var(--border-color);
}

.workspace-main {
  min-width: 0;
}

.workspace-bottom-nav {
  display: none;
}

@media (max-width: 899px) {
  .workspace-shell {
    grid-template-columns: minmax(0, 1fr);
    padding-bottom: 72px;
  }

  .workspace-sidebar {
    display: none;
  }

  .workspace-stage {
    height: auto;
    min-height: 100vh;
  }

  .workspace-topbar {
    padding: 10px 14px;
  }

  .workspace-topbar__product,
  .topbar-button span {
    display: none;
  }

  .workspace-bottom-nav {
    position: fixed;
    z-index: 70;
    inset: auto 10px 10px;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    padding: 8px;
    border-radius: 20px;
  }

  .workspace-bottom-nav button {
    min-height: 48px;
    display: grid;
    place-items: center;
    gap: 2px;
    color: var(--text-secondary);
    font-size: 10px;
  }

  .workspace-bottom-nav .nav-item--active {
    color: var(--accent-color);
  }
}
</style>
