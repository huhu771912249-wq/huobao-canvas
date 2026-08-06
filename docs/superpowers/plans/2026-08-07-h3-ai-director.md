# H3 AI Director Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a short natural-language idea into a professional, reviewable MiniMax H3 director plan and an executable 1080p video workflow.

**Architecture:** A pure plan-normalization module owns schema validation, deterministic defaults, prompt compaction, and fallback behavior. The workflow orchestrator asks the local Gemma endpoint for strict JSON and then creates an explicit H3 video workflow. Canvas renders a director-plan preview and controls whether applying the plan also spends model quota.

**Tech Stack:** Vue 3, Vue Flow, Vite, Node assertion tests, existing OpenAI-compatible local Gemma endpoint, MiniMax H3 video node.

---

### Task 1: Director plan contract and fallback

**Files:**
- Create: `src/utils/h3DirectorPlan.js`
- Create: `tests/h3DirectorPlan.test.mjs`
- Modify: `package.json`

- [ ] Write assertions covering short Chinese input, explicit overrides, malformed JSON fallback, 1000-character limit, adult-person default, continuous-shot action timeline, and H3/1080p defaults.
- [ ] Run `node tests/h3DirectorPlan.test.mjs`; expect failure because the module does not exist.
- [ ] Implement `normalizeH3DirectorPlan`, `buildFallbackH3DirectorPlan`, `parseDirectorResponse`, and `buildH3VideoPrompt` as pure functions.
- [ ] Run the test and full `npm test`; expect pass.
- [ ] Commit contract and tests.

### Task 2: Professional local Gemma system prompt

**Files:**
- Create: `src/config/h3DirectorPrompt.js`
- Modify: `src/hooks/useWorkflowOrchestrator.js`
- Test: `tests/h3DirectorWiring.test.mjs`

- [ ] Write a failing static contract test requiring Role, Profile, Goals, Constraints, Skills, Workflow, three examples, OutputFormat, Initialization, local model `gemma4-31b-heretic`, and deterministic JSON parsing.
- [ ] Run `node tests/h3DirectorWiring.test.mjs`; expect failure.
- [ ] Implement the modular prompt and change `analyzeIntent` to call local Gemma, parse balanced JSON, normalize it, and expose whether AI or rules supplied the plan.
- [ ] Run targeted and full tests; expect pass.
- [ ] Commit the director intelligence.

### Task 3: Explicit H3 workflow execution

**Files:**
- Modify: `src/hooks/useWorkflowOrchestrator.js`
- Modify: `src/components/nodes/VideoConfigNode.vue` only if existing data hydration does not honor model/ratio/duration/quality.
- Test: `tests/h3DirectorWiring.test.mjs`

- [ ] Add failing assertions for `h3_video`, `minimax-h3`, `quality`, ratio, duration, prompt-to-video edge, and optional keyframe branch.
- [ ] Implement direct H3 text-to-video creation and a keyframe-assisted branch without removing legacy workflow types.
- [ ] Ensure config data initializes the video node controls and auto-executes only when explicitly requested by the caller.
- [ ] Run targeted/full tests and build; expect pass.
- [ ] Commit workflow execution.

### Task 4: Director preview UI

**Files:**
- Modify: `src/views/Canvas.vue`
- Modify: `src/assets/main.css` or the existing Canvas scoped style block.
- Test: `tests/h3DirectorWiring.test.mjs`

- [ ] Write failing UI contract assertions for “冠希 H3 导演”, plan status, model/duration/ratio chips, character/environment/cinematography fields, “应用到画布”, and “生成 H3 视频”.
- [ ] Replace generic template and suggestions, default auto-generate on, show the normalized plan card, and retain the input on failure.
- [ ] Remove silent text-to-image fallback; show whether the plan came from Gemma or deterministic rules.
- [ ] Run tests/build and inspect desktop/mobile layouts.
- [ ] Commit the UI.

### Task 5: End-to-end deployment acceptance

**Files:**
- Modify only deployment artifacts produced by `npm run build`.

- [ ] Run `npm test`, `npm run build`, and backend prompt/API tests.
- [ ] Back up the current server frontend and relevant backend files.
- [ ] Deploy, restart `guanxi-canvas`, verify `/health`, fresh asset hashes, and no console errors.
- [ ] In the real web page, enter one short Chinese request; verify the director card and created H3 nodes. Submit one bounded test video and verify real task stage, preview, and download.
- [ ] Record any upstream limitation explicitly; only then mark the goal complete.

