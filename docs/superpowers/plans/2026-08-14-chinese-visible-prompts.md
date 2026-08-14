# AI 可见提示词中文化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让冠希无限画布所有 AI 自动生成的用户可见提示词使用简体中文，并拦截 H3 异常英文结果。

**Architecture:** 第一层在 H3 导演与通用工作流系统提示词中加入已由用户确认的中文输出协议。第二层在 H3 规范化入口通过中文可读性检测，将英文占比异常的可见字段替换为现有中文规则回退值，不改变 JSON 键名或下游模型接口。

**Tech Stack:** Vue 3、Vite、JavaScript ESM、Node.js assert 测试、pnpm

---

### Task 1: 锁定中文输出协议

**Files:**
- Modify: `tests/h3DirectorPrompt.test.mjs`
- Modify: `tests/promptPolicy.test.mjs`
- Modify: `src/config/h3DirectorPrompt.js`
- Modify: `src/hooks/useWorkflowOrchestrator.js`

- [ ] **Step 1: 写入失败测试**

在 `tests/h3DirectorPrompt.test.mjs` 导入 `H3_DIRECTOR_SYSTEM_PROMPT`，并断言提示词包含简体中文、JSON 键名保持英文、禁止整段英文和禁止双语重复。继续在 `tests/promptPolicy.test.mjs` 对 `useWorkflowOrchestrator.js` 源码断言已覆盖 `image_prompt`、`video_prompt`、`shots[].prompt`、`multi_angle.character_description` 和 `picture_book.pages[].illustration_prompt`。

```js
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /所有面向用户展示的字符串值必须使用简体中文/)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /JSON 键名.*英文/)
assert.match(H3_DIRECTOR_SYSTEM_PROMPT, /不得同时输出中英文两套提示词/)

for (const field of [
  'image_prompt',
  'video_prompt',
  'shots[].prompt',
  'multi_angle.character_description',
  'picture_book.pages[].illustration_prompt'
]) {
  assert.match(orchestrator, new RegExp(field.replaceAll('.', '\\\\.').replaceAll('[', '\\\\[').replaceAll(']', '\\\\]')))
}
assert.match(orchestrator, /所有用户可见的字符串值必须使用简体中文/)
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node tests/h3DirectorPrompt.test.mjs && node tests/promptPolicy.test.mjs`

Expected: FAIL，缺少“所有面向用户展示的字符串值必须使用简体中文”或“所有用户可见的字符串值必须使用简体中文”。

- [ ] **Step 3: 加入用户确认的两段语言协议**

在 `H3_DIRECTOR_SYSTEM_PROMPT` 的 Constraints 后加入 `# LanguagePolicy`，逐项写入用户确认的 H3 文本。在 `INTENT_ANALYSIS_PROMPT` 的“提示词优化要求”前加入普通工作流“语言要求”，明确可见字段使用中文、专业术语保留、禁止整段英文和双语重复。

- [ ] **Step 4: 运行协议测试并确认通过**

Run: `node tests/h3DirectorPrompt.test.mjs && node tests/promptPolicy.test.mjs`

Expected: 两个脚本均输出 `passed`，退出码为 0。

- [ ] **Step 5: 提交协议改动**

```bash
git add src/config/h3DirectorPrompt.js src/hooks/useWorkflowOrchestrator.js tests/h3DirectorPrompt.test.mjs tests/promptPolicy.test.mjs
git commit -m "fix: require Chinese AI prompt output"
```

### Task 2: 拦截 H3 异常英文可见字段

**Files:**
- Modify: `tests/h3DirectorPlan.test.mjs`
- Modify: `src/utils/h3DirectorPlan.js`

- [ ] **Step 1: 写入英文异常回退失败测试**

构造以英文为主的 H3 返回，调用 `normalizeH3DirectorPlan`，断言 `summary`、角色、环境、摄影、灯光、时间线、声音、图片提示词、负面提示词及最终视频提示词不再原样包含英文句子；再断言中文字段和 `H3`、`24mm`、`16:9` 等术语保留。

```js
const englishLeak = normalizeH3DirectorPlan({
  title: 'Fashion walk',
  summary: 'A woman walks through a hotel corridor under warm cinematic lighting',
  character: { appearance: 'Elegant woman with long black hair and a black dress' },
  environment: { location: 'Luxury hotel corridor' },
  cinematography: { lens: '24mm', camera_movement: 'Smooth tracking shot' },
  image_prompt: 'Full body fashion portrait in a luxury hotel corridor',
  negative_prompt: 'blurry face, distorted hands'
}, '一位穿黑色礼服的成年女性走过酒店走廊，H3，24mm，16:9')

assert.doesNotMatch(englishLeak.video_prompt, /A woman walks|Luxury hotel corridor|Smooth tracking shot/)
assert.doesNotMatch(englishLeak.image_prompt, /Full body fashion portrait/)
assert.match(englishLeak.video_prompt, /酒店走廊/)
assert.match(englishLeak.video_prompt, /24mm/)
```

- [ ] **Step 2: 运行测试并确认正确失败**

Run: `node tests/h3DirectorPlan.test.mjs`

Expected: FAIL，规范化结果仍包含 `A woman walks` 或 `Full body fashion portrait`。

- [ ] **Step 3: 实现最小中文可读性保护**

在 `src/utils/h3DirectorPlan.js` 增加内部函数：

```js
const isEnglishDominant = value => {
  const normalized = text(value)
  const latinWords = normalized.match(/[A-Za-z]{2,}/g) ?? []
  const chineseChars = normalized.match(/[\u3400-\u9fff]/g) ?? []
  return latinWords.length >= 4 && latinWords.join('').length > chineseChars.length * 2
}

const visibleText = (value, fallback) => (
  isEnglishDominant(value) ? text(fallback) : text(value, fallback)
)
```

在 `normalizeH3DirectorPlan` 中仅将用户可见自然语言字段改用 `visibleText`；比例、时长、模型枚举、布尔值和允许的焦段等结构化参数继续沿用现有处理。回退内容来自 `userInput`、`inferCharacter`、`inferLocation`、`inferShotSize`、`inferCameraMovement` 及现有中文默认值。

- [ ] **Step 4: 运行 H3 测试并确认通过**

Run: `node tests/h3DirectorPlan.test.mjs`

Expected: 输出 `h3DirectorPlan.test.mjs passed`，退出码为 0。

- [ ] **Step 5: 提交规范化保护**

```bash
git add src/utils/h3DirectorPlan.js tests/h3DirectorPlan.test.mjs
git commit -m "fix: prevent English H3 prompts from leaking into canvas"
```

### Task 3: 全量验证与同步准备

**Files:**
- Verify only; no planned source changes

- [ ] **Step 1: 运行格式检查**

Run: `pnpm lint`

Expected: 退出码为 0，无 ESLint errors 或 warnings。

- [ ] **Step 2: 运行完整测试**

Run: `pnpm test`

Expected: 所有测试脚本输出 `passed`，退出码为 0。

- [ ] **Step 3: 运行生产构建**

Run: `pnpm build`

Expected: Vite build 成功，退出码为 0。

- [ ] **Step 4: 核对差异与提交历史**

Run: `git status --short && git log --oneline personal/main..HEAD && git diff --check personal/main...HEAD`

Expected: 工作树干净；只有设计、计划、语言协议、测试及 H3 规范化相关提交；`git diff --check` 退出码为 0。

- [ ] **Step 5: 推送独立分支**

Run: `git push -u personal fix/chinese-visible-prompts`

Expected: 远端创建或更新 `fix/chinese-visible-prompts`，不修改 `main`。

- [ ] **Step 6: 发布前核对**

在发布前记录前端和后端 Commit SHA，生成新 release 目录与 manifest，再切换 `current`。重启服务后检查 `/health`、首页和实际新建 H3/普通工作流可见提示词；仅在页面显示中文后确认业务验收。
