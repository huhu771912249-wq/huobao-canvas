<template>
  <section id="projects" class="recent-projects workspace-reveal">
    <header>
      <div>
        <span>WORKSPACE</span>
        <h2>最近项目</h2>
      </div>
      <button type="button" :disabled="busy" @click="$emit('create')">
        <n-icon :size="18"><AddOutline /></n-icon>
        新建项目
      </button>
    </header>

    <div v-if="projects.length" class="project-grid">
      <article v-for="project in visibleProjects" :key="project.id" class="project-card">
        <button type="button" class="project-card__preview" :disabled="busy" @click="$emit('open', project)">
          <video
            v-if="isVideoUrl(project.thumbnail)"
            :src="project.thumbnail"
            muted
            loop
            playsinline
            preload="none"
          ></video>
          <img v-else-if="project.thumbnail" :src="project.thumbnail" :alt="project.name" loading="lazy" decoding="async" />
          <span v-else class="project-card__empty">
            <n-icon :size="30"><DocumentOutline /></n-icon>
          </span>
          <span class="project-card__open">打开项目</span>
        </button>
        <div class="project-card__meta">
          <div>
            <strong>{{ project.name }}</strong>
            <span>{{ formatDate(project.updatedAt) }}</span>
          </div>
          <n-dropdown :options="actions" @select="(key) => $emit('action', key, project)">
            <button type="button" aria-label="项目操作">
              <n-icon :size="18"><EllipsisHorizontalOutline /></n-icon>
            </button>
          </n-dropdown>
        </div>
      </article>
    </div>

    <button v-if="hasMoreProjects" type="button" class="load-more-projects" @click="showMoreProjects">
      显示更多项目（剩余 {{ projects.length - visibleProjects.length }} 个）
    </button>

    <div v-else class="project-empty workspace-panel">
      <n-icon :size="38"><FolderOpenOutline /></n-icon>
      <strong>还没有创作项目</strong>
      <p>从上方选择一个工作流，第一条结果会自动成为项目封面。</p>
      <button type="button" @click="$emit('create')">创建第一个项目</button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { NDropdown, NIcon } from 'naive-ui'
import {
  AddOutline,
  DocumentOutline,
  EllipsisHorizontalOutline,
  FolderOpenOutline
} from '@vicons/ionicons5'

const props = defineProps({
  projects: {
    type: Array,
    default: () => []
  },
  formatDate: {
    type: Function,
    required: true
  },
  busy: {
    type: Boolean,
    default: false
  }
})

defineEmits(['create', 'open', 'action'])

const actions = [
  { label: '重命名', key: 'rename' },
  { label: '复制', key: 'duplicate' },
  { type: 'divider' },
  { label: '删除', key: 'delete' }
]

const INITIAL_VISIBLE_PROJECTS = 12
const PROJECT_PAGE_SIZE = 12
const visibleCount = ref(INITIAL_VISIBLE_PROJECTS)
const visibleProjects = computed(() => props.projects.slice(0, visibleCount.value))
const hasMoreProjects = computed(() => visibleProjects.value.length < props.projects.length)
const showMoreProjects = () => { visibleCount.value += PROJECT_PAGE_SIZE }
watch(() => props.projects.length, length => {
  if (length < visibleCount.value) visibleCount.value = Math.max(INITIAL_VISIBLE_PROJECTS, length)
})

const isVideoUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  return ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv']
    .some((extension) => url.toLowerCase().includes(extension))
}
</script>

<style scoped>
.recent-projects {
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 28px 80px;
  animation-delay: 90ms;
}

.recent-projects header,
.project-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.recent-projects header span {
  color: var(--accent-color);
  font-size: 10px;
  letter-spacing: 0.16em;
}

.recent-projects h2 {
  margin-top: 4px;
  font-size: 24px;
}

.recent-projects header > button,
.project-empty button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 0 14px;
  border-radius: 12px;
  color: #07110d;
  background: var(--accent-color);
  font-weight: 700;
}

.load-more-projects {
  min-height: 40px;
  display: block;
  margin: 22px auto 0;
  padding: 0 18px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  color: var(--text-secondary);
  background: var(--panel-strong, var(--bg-secondary));
}

.load-more-projects:hover {
  color: var(--text-primary);
  border-color: rgba(101, 230, 189, 0.45);
}

.project-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-top: 18px;
}

.project-card__preview {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 18px;
  background: var(--bg-secondary);
}

.project-card__preview img,
.project-card__preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 220ms ease;
}

.project-card__preview:hover img,
.project-card__preview:hover video {
  transform: scale(1.03);
}

.project-card__empty {
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  background:
    linear-gradient(145deg, rgba(110, 168, 255, 0.08), transparent),
    var(--bg-secondary);
}

.project-card__open {
  position: absolute;
  inset: auto 10px 10px;
  padding: 7px 10px;
  border-radius: 10px;
  color: white;
  background: rgba(8, 11, 18, 0.78);
  font-size: 11px;
  opacity: 0;
  transform: translateY(5px);
  transition: opacity 180ms ease, transform 180ms ease;
}

.project-card__preview:hover .project-card__open {
  opacity: 1;
  transform: translateY(0);
}

.project-card__meta {
  margin-top: 10px;
}

.project-card__meta > div {
  min-width: 0;
  display: grid;
}

.project-card__meta strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.project-card__meta span {
  color: var(--text-secondary);
  font-size: 11px;
}

.project-card__meta button {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  color: var(--text-secondary);
}

.project-card__meta button:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.project-empty {
  min-height: 240px;
  margin-top: 18px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  border-radius: 22px;
  color: var(--text-secondary);
  text-align: center;
}

.project-empty strong {
  color: var(--text-primary);
}

.project-empty button {
  margin-top: 8px;
}

@media (max-width: 980px) {
  .project-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .recent-projects {
    padding: 20px 16px 88px;
  }

  .project-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
