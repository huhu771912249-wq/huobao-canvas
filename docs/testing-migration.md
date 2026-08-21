# 把 grep 型测试转成真组件测试

> 这份文档是给后续批量转换的人照着做的操作手册。
> 目标：**等价或加强，绝不削弱**。

## 0. 现状

| | 数量 |
|---|---|
| `tests/*.test.mjs`（node 原生断言脚本） | 72 |
| 其中用 `readFileSync` 扫源码的 | 47 |
| `tests/component/*.spec.mjs`（vitest + jsdom + 真组件） | 4 |

`src/` 下 138 个文件里有 100 个被测试按路径写死。下一阶段要收敛 7 份宽高比推导、
11 处轮询、14 份 base64，这批 grep 会把成本放大 3–5 倍，所以先换测试。

历史教训：PR #36 拆掉 H3 节点高度护栏时，把守卫它的测试**一起改宽了**，
放跑了「进画板后除 H3 外所有节点都点不动」的线上 bug，#41 才修回来。
**转换测试时把断言放宽，等于自己删护栏。**

## 1. 怎么跑

```bash
pnpm test            # 两条泳道：glob 出来的 node 脚本 + vitest 组件测试
pnpm test:component  # 只跑组件测试
pnpm test:watch      # 组件测试 watch 模式
pnpm run ci          # lint + test + build
```

`scripts/run-tests.mjs` 是唯一入口，两条泳道都靠 **glob 发现**：

- **泳道 A（存量）** `tests/**/*.test.mjs` —— 每个文件单独 `node` 子进程跑
  （很多文件在模块顶层往 `window` / `localStorage` / `fetch` 上装桩，
  同进程会互相污染），并发跑完 72 个约 0.3 秒。
- **泳道 B（新增）** `tests/component/**/*.spec.mjs` —— vitest + jsdom。

`package.json` 里**不再有任何手写测试清单**（原来的 `pretest` + `test` 两条 `&&` 长链
共 74 项，曾漏掉 3 个文件整整一年，见 #44）。
`tests/component/testDiscovery.spec.mjs` 会守住这一点：任何 script 里出现
`tests/xxx.mjs` 字样都会红。

**新文件怎么命名**：转换后的测试放 `tests/component/<原名>.spec.mjs`。
不要在 `tests/component/` 下放 `.test.mjs`（会被泳道 A 当 node 脚本跑）。

## 2. grep 型断言分五类

按「锁的是什么」分类，**先分类再动手**，不同类处理方式完全不同。

### A 类：锁纯逻辑，但绕着模块边界走

特征：`data:text/javascript` + 正则把源码里的一段函数抠出来动态 `import()`。
现存 6 个：`videoRatioOutputSizeContract`、`imageReferenceContract`、
`canvasNativeSelectors`、`novelVideoApi`、`novelVideoWorkspace`、
`h3DirectorUiWiring`、`watermarkEditorWorkflow`。

例（`videoRatioOutputSizeContract.test.mjs`）：

```js
const ratioContractSource = videoSource.match(
  /\/\/ --- video ratio\/output-size contract ---([\s\S]*?)\/\/ --- end .../
)?.[1]
const { getVideoRatioFromOutputSize } = await import(
  `data:text/javascript,${encodeURIComponent(ratioContractSource + '\nexport {...}')}`
)
```

**怎么转**：这段逻辑本来就该是一个模块。把它从 `.vue` 里搬到 `src/utils/`，
测试改成普通 `import`。断言本身一个字都不用改 —— 它们已经是行为断言了。

⚠️ 这类转换**同时动源码**，必须单独一个 PR，且先确认没有别的测试锁着那段注释锚点。

### B 类：锁 CSS 类名 / DOM 结构

特征：`assert.match(source, /class="[^"]*\bfoo\b/)`、
`assert.equal((source.match(/overflow-y-auto/g)||[]).length, 1)`、
断言 HTML 注释相对位置。

**怎么转**：挂载组件，断言**渲染后的 DOM**。三个梯度，从上往下优先选：

1. **能断言行为就断言行为。** 「shell 上不能有 `nodrag`」的真意思是
   「这个节点能被拖动」→ 用 `dragFrom()` 真拖一次，断言 vue-flow store 里的
   position 变了。见 `tests/component/canvasNodeDragging.spec.mjs`。
2. **能断言计算样式就断言计算样式。** `loadCanvasStyles()` 会把 `src/style.css`
   和**项目真实编译出来的 Tailwind utilities** 一起注入 jsdom，
   于是 `getComputedStyle(el).overflowY === 'auto'` 是可信的。
3. **实在只能断言类名，也要断言在渲染后的元素上**，不要断言源码字符串。
   拆组件不会改变渲染树，但会改变源文件里字符串的出现次数。

### C 类：锁盒模型 / 遮挡这类「真实布局行为」

特征：`canvasNodeOcclusion`、`globalPageScroll` 那种 —— 想说的是
「节点不能长到盖住别的节点」，但只能靠比对两个源码常量来近似。

**怎么转**：`tests/component/helpers/cssBox.mjs` 提供一个最小布局预言机。
jsdom 不排版（`getBoundingClientRect()` 恒为 0），但盒子高度这件事只需要
浏览器的一条规则：`height = min(内容高, max-height)`。

```js
const shell  = nodeEl.firstElementChild.firstElementChild
const height = paintedHeight(shell, { contentHeight: 1370, viewport: { width: 1440, height: 900 } })
expect(rectanglesOverlap(paintedBounds, neighbourBounds)).toBe(false)
```

`contentHeight` 取「不加护栏时内容想长到多高」（H3 是 #36 实测的 ~1370px）。
`rectanglesOverlap` / `getNodeBounds` / `findOpenNodePosition` 直接用
`src/utils/canvasLayout.js` 的生产代码，邻居位置由生产的自动布局算出来。
完整例子见 `tests/component/canvasNodeOcclusion.spec.mjs`。

### D 类：锁「某个东西被接上了」的接线契约

特征：`assert.match(canvas, /<ComputeStatusIndicator/)`、
`assert.match(canvas, /videoGif: markRaw/)`、`assert.match(api, /\/v1\/material-inputs/)`。

**怎么转**：需要挂载 `Canvas.vue` / `VideoStudio.vue` 这种大视图，成本高。
**最后一批再做**，先留着 grep，不要为了消灭 grep 而把断言删掉。
留下来的时候补一条注释说明「为什么还没转」。

### E 类：锁实现细节，可以直接删

特征：断言的那行源码**并不决定任何用户可见行为**。

实例（本轮实测）：`computeStatus.test.mjs` 断言
`const collapsed = ref(true)`，但 `onMounted` 里的 `readStoredState()`
立刻会覆盖这个初值 —— 把 `ref(true)` 改成 `ref(false)`，行为完全不变，
真正决定默认折叠的是 `readStoredState` 里的 `stored === null ? true : ...`。
这条 grep 锁的是一行**死代码**。

**怎么处理**：不要「等价保留」一条锁死代码的断言。
把它替换成对应的**可观察行为**断言（首屏渲染出来的是折叠态卡片），
然后用变异验证新断言确实盯住了真正的决策点。

## 3. 每转一个，必须做的三件事

1. **写清楚原测试锁的是什么**：实现细节还是行为契约。写在新 spec 的文件头注释里，
   并把「grep → 新断言」的对应关系列成表（照抄
   `tests/component/computeStatusIndicator.spec.mjs` 的头注释格式）。
2. **变异验证**：把被测行为改坏，新测试必须变红。至少两种变异：
   - 一种是老测试也能抓到的（证明没削弱）；
   - 一种是老测试抓不到的（证明加强了）。
   把两次输出贴进 PR。
3. **删除时留痕**：如果原文件只被部分转换，在原文件里留注释指向新 spec
   （见 `tests/computeStatus.test.mjs`、`tests/globalPageScroll.test.mjs`）。
   如果整文件被替换，`git rm` 掉，并在 PR 里写明新 spec 覆盖了哪几条。

## 4. 工具箱

### `tests/component/helpers/canvasHarness.mjs`

- `mountCanvas({ nodeTypes, nodes, viewport })`
  把节点组件挂进真的 `<VueFlow>`。**节点组件不能单独挂载** —— 里面的 `<Handle>`
  会去 vue-flow 的 node store 里找自己，找不到就抛
  `Cannot read properties of undefined (reading 'dimensions')`。
  返回 `{ wrapper, flow, nodeElement(id), nodeShell(id, selector), viewport, unmount }`。
  所有查询都**限定在本次挂载的根元素内**，不查 `document`。
- `dragFrom(el, { from, to })` 真实鼠标拖拽。注意里面发了**两次** `mousemove`：
  vue-flow 默认 `nodeDragThreshold = 1`，第一次只是「上膛」，第二次才真的拖。
  这是浏览器行为，不是测试技巧。
- `createTestRouter()` memory router，凡是用 `useRouter()` 的组件都要给。

### `tests/component/helpers/cssBox.mjs`

- `loadCanvasStyles()` 注入 `src/style.css` + 真实编译的 Tailwind utilities
  （postcss 跑一次约 250ms，按 worker 缓存）。
- `setViewport({ width, height })` 钉住 `window.innerWidth/innerHeight`，让 `100vh` 有确定值。
- `resolveCssLength('calc(100vh - 120px)', viewport)` → `780`。
- `effectiveMaxHeight(el, viewport)` 行内样式优先，否则走样式表级联。
- `paintedHeight(el, { contentHeight, viewport })` → `min(contentHeight, max-height)`。

### `tests/component/setup.mjs`

jsdom 缺什么就在这里补，**不要往里塞跟具体测试相关的桩**：
`ResizeObserver`、`IntersectionObserver`、`matchMedia`、
`Document.elementFromPoint`（vue-flow 连线命中测试用）、
`DOMMatrixReadOnly`（vue-flow 读缩放用）。
另外这里装了 `enableAutoUnmount(afterEach)` + 清空 `document.body`：
组件都用 `attachTo: document.body` 挂载，少了这一步，
**一个真失败会连环变成十个假失败**（后面的用例查到的是前一个用例的尸体）。

## 5. 已知限制（写测试前先知道）

- **jsdom 不排版。** `getBoundingClientRect()` 恒为 0，`offsetHeight` 恒为 0。
  凡是要「盒子多大」的断言，都得走 `cssBox.mjs` 那条路，或者自己 `stubRect()`。
- **`window` 不是 jsdom 的 Window。** vitest 把 jsdom 的全局摊到 `globalThis` 上，
  所以 `new MouseEvent(t, { view: window })` 会报
  `member view is not of type Window`。用 `canvasHarness` 里的事件构造函数。
- **`import.meta.url` 在 vitest 里不是 `file:` 协议。** 读文件用
  `path.resolve(process.cwd(), ...)`。
- Tailwind 只编译了 `@tailwind utilities`，没有 `base`/`preflight`。

## 6. 剩余 47 个的分批建议

| 批次 | 内容 | 数量 | 说明 |
|---|---|---|---|
| 1 | E 类清理：逐个确认哪些 grep 锁的是死代码 | — | 不改测试文件，只出一份清单，后面每批照着删 |
| 2 | 单文件 · 单组件的 B 类 | ~8 | `videoInputActions` `storyboardReset` `textOverlayVideoSourceContract` `videoStudioWiring` `materialInputNode` `dspH3UpgradeSourceContract` `globalVideoSizeWiring` `canvasMediaNodes`。都是 12–32 行，一人一天能吃掉一半 |
| 3 | A 类：把内联契约提成模块 | 6 | `videoRatioOutputSizeContract` `imageReferenceContract` `novelVideoApi` `novelVideoWorkspace` `h3DirectorUiWiring` `watermarkEditorWorkflow`。**每个单独 PR**，因为要动 `src/` |
| 4 | 节点级行为契约 | ~6 | `nodeGenerationFailureFeedback` `videoTaskStatus` `h3SpeedQualityWorkflow` `global1080Quality` `scail2ActionTransfer` `canvasNativeSelectors`。挂单个节点组件 + 打桩 API，直接断言「空结果要退出 loading 并报错」这类真行为 |
| 5 | 视图级（要挂 `Canvas.vue` / `VideoStudio.vue`） | ~10 | `canvasNodeRegistry` `canvasPerformance` `navigationState` `workspaceUi` `taskCenter` `legacyFeatureContract` `novelTaskCenter` `globalPageScroll` 余下部分 `computeStatus` 余下部分 `videoResizeWorkbench`。**先做一个 spike**：确认 `Canvas.vue` 能在 jsdom 里挂起来，再排后面的 |
| 6 | 纯 util 型残留 grep | ~10 | `chatStream` `pollingBudget` `serviceHealth` `backgroundReplace` `materialVariation` `authSignOut` `sessionGuard` `appInteractionBridge` `dspCreativeLibrary` `videoQueueVisibility`。这些已经有真 import，grep 只是尾巴，多数可归 D/E 类，直接删或留 |

**批次 2、4、6 可以并行**（互不重叠的文件所有权）；
**批次 3 必须串行**，因为它动 `src/`；**批次 5 依赖批次 3 的 spike 结论**。

每批的验收都一样：`pnpm run ci` 绿 + 每个转换的变异实证 + 泳道 A 的文件数只减不漏
（`pnpm test` 末尾会打印 `discovered by glob: N legacy test files + M component spec files`）。
