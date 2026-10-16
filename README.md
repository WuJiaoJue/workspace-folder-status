<div align="center">

<img src="icon.svg" width="72" alt="dsh-group-status"/>

# dsh-group-status — 收起的分组也看得见活

**中文** | [English](./README.en.md)

[![version](https://img.shields.io/badge/version-0.2.0-0EA5E9)](https://github.com/dsh-plugin-collection/dsh-group-status)
[![license](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![DSH](https://img.shields.io/badge/DeepSeek%20Harness-0.2.0--rc.2-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

</div>

> DSH 侧栏里**分组一收起，里面会话的状态就跟着折叠消失**——进行中、待审批、等待评审全看不见了。这个插件让收起的文件夹行自己长出聚合徽标：**黄点待审批、转圈进行中**，再挂上定时任务与等待评审两个图标，带数字、悬停看明细；展开后一个像素都不改，子行自带状态。

---

## 效果预览

**收起的文件夹行自带聚合徽标** —— 下面 `tmp` 有 1 个进行中（转圈）、1 个已完成（绿点）、1 个定时任务（时钟），数字 `3`：

<p align="center">
<img src="docs/media/screenshot-folders.png" width="267" alt="侧栏中收起的 tmp 分组：转圈、绿点、时钟图标与数字 3"/>
</p>

**悬停看明细** —— hover 卡在原路径、创建时间下面追加聚合明细行：

<p align="center">
<img src="docs/media/screenshot-hover.png" width="300" alt="悬停卡片：1 等待回答 · 1 进行中"/>
</p>

> 徽标复用的就是 DSH 原生 `StateDot`，颜色与行内状态同源，不会走样。上面两张是实机截图。

---

## 使用方法

收起任意有活会话的分组，文件夹名后面出现徽标：

| 符号 | 含义 | 颜色 |
|---|---|---|
| 黄点 | 组内有待审批 / 计划待审 / 待回答 | warning（与行内一致）|
| 转圈 | 组内有进行中（含运行中的子智能体） | ongoing（`StateDot` 转圈动画）|
| 绿点 | 组内有已完成未读的会话 | done（与行内一致）|
| 时钟 | 组内有定时任务（数据来自 dsh-later） | 紫 · 橙（≤5 分钟）· 红（已到期）|
| 列表笔 | 组内有等待评审的 PR（数据来自 dsh-gitea-dispatch） | 琥珀 · 红（CI 等待窗口已到期）|

规则：

- **已完成进徽标**：`done`（已完成未读）折叠时也显示绿点，和会话行的绿点同一个 `StateDot` 状态；一组只剩已完成时徽标照常出现。
- **数字** = 待审批 + 进行中（**含运行中的子智能体**）+ 已完成 + 有定时任务的会话 + 等待评审的会话；数字是否出现受 `countThreshold` 控制（默认 2，即只剩 1 项时只画点、不显数字）。
- **悬停明细**：文件夹行 hover 卡在路径、创建时间下面，按 `等待审批 · 计划待审 · 等待回答 · 进行中 · 子智能体 · 等待评审 · 定时任务 · 已完成` 的顺序追加明细行，例如 `1 等待回答 · 1 进行中`。等待评审那一行带**在等的 PR 号**与**还剩多久**，例如 `1 等待评审（剩 3分钟） · #2783`。
- **展开即让位**：聚合徽标只在折叠时出现；展开后子行自带状态，不重复显示。
- **无障碍**：徽标是 `role="img"` + 本地化 `aria-label`（如 `1 等待回答 · 1 进行中`），悬停 `title` 同文案，读屏与鼠标都读得到。等待评审的 `waiting` 与 `overdue` 在文案里就是两句话（`等待评审` / `等待评审（已超时）`），不只是颜色不同。
- **脉冲只给定时任务**：等待评审超时不闪动。数据所有者 dsh-gitea-dispatch 把自己那条会话行的超时图标画成**静止**（其 `lib/waiting-glyph.js`：「静止即不再期待」），且它的 `overdue` 只代表 CI 的等待窗口到期、不代表评审失败。同一条等待在父级徽标上闪、在行内静止，就是同一事实的两种说法。红色保留，与提供方同色。

### 设置项

侧栏 **插件** → **dsh-group-status**（bundle 详情页的配置表单，在描述与「包含的组件」之间）：

| 字段 | 默认 | 说明 |
|---|---|---|
| `showRunningInBadge` | `true` | 折叠徽标是否显示「进行中」转圈 |
| `showPendingInBadge` | `true` | 折叠徽标是否显示「待审批 / 待评审 / 待回答」黄点 |
| `showCompletedInBadge` | `true` | 折叠徽标是否显示「已完成」绿点 |
| `showScheduledInBadge` | `true` | 折叠徽标是否显示「定时任务」时钟图标（数据来自 dsh-later） |
| `showWaitingReviewInBadge` | `true` | 折叠徽标是否显示「等待评审」列表笔图标（数据来自 dsh-gitea-dispatch） |
| `showHoverDetails` | `true` | 悬停卡是否显示聚合状态明细行 |
| `countThreshold` | `2` | 徽标数字显示阈值：数量 >= 此值时才显示数字（默认 2，即 count=1 时省略——点已表达"有东西在发生"；设为 1 则始终显示） |

按状态关掉后，对应的来源完全退出折叠行的聚合提示——不画点/图标、不计入徽标数字、不进悬停明细、不参与「是否显示徽标」的判断。**会话行自身的状态点不受影响**：那是行级状态，不是分组提示。`showHoverDetails` 关闭后，悬停卡只显示标题、路径与创建时间。

点「保存」后即时生效，无需刷新；设置由宿主写进 profile patch 的 `dsh-group-status` 条目 `config`，刷新页面后仍在。设置面读不到时（例如宿主未提供设置服务）回落为默认「显示」，与 schema 默认值同源——读不到配置不等于用户关掉了。

---

## 特性一览

- **收起可见**：聚合状态只在分组折叠时出现，展开后的侧栏与官方版本逐像素一致。嵌套分组也支持——父分组折叠时，徽标聚合所有后代分组的会话状态。
- **与行内同源**：优先级、颜色、文案全部复用行内状态的派生逻辑与 `StateDot`，跳过空白会话与已归档会话。
- **跨插件聚合**（可选）：dsh-later 的定时任务、dsh-gitea-dispatch 的等待评审，两个都没装也照常工作——见下。
- **零配置可用**：默认开箱即用；7 个设置项可精细控制折叠徽标的来源显隐、悬停明细与数字样式。
- **本体零改动**：官方 `dsh-client-ui-workspace` 包文件一个不动；改动全在本仓库源码里，profile 补丁只有两条（装本包、禁用官方行）。
- **多语言**：跟随 DSH 界面语言（中文 / English），复用官方文案键；本包新增 `status.waitingReview`、`status.scheduled`、陌生来源无文案时的兜底 `status.needsAttention`，以及等待评审的三档状态文案 `status.waitingReviewOverdue` / `status.waitingReviewImminent` / `status.waitingReviewLeft`。

---

## 跨插件状态：facet 协议

折叠分组徽标可以显示**别的插件**的状态。方向是反的：**状态所有者把自己的事实注册进来**，本插件不为任何具体插件写适配。完整契约见 [docs/facet-protocol.md](docs/facet-protocol.md)。

```js
const gs = require('dsh-group-status/client')
const unregister = gs?.registerGroupStatusFacet?.({
  protocol: gs.GROUP_STATUS_FACET_PROTOCOL_VERSION,
  id: 'my-plugin.review',              // '<包名>.<状态名>'
  subscribe: store.subscribe,           // 外部存储面，不是 React hook
  getSnapshot: store.getSnapshot,
  fold: (snapshot, sessionIds, now) => ({ count, tone, pulse, data }),
  merge, label, renderIcon, settingKey, order,   // 全部可选
})
ctx.effect(() => () => unregister?.(), 'my-plugin: group status facet')
```

- 只交 `protocol` / `id` / `subscribe` / `getSnapshot` / `fold` 五项就能显示：「N 需要关注」加一个按色档取色的通用点。**不会**把内部 id 念给用户。
- 图标与文案归提供方（`renderIcon` / `label`）：「这个状态长什么样、超时该静止还是该闪」是它的知识。上一版由本插件按状态名反推，结果与提供方自己的行内图标相反（提供方把 `overdue` 画成静止，徽标却在脉冲）。
- 折叠的父文件夹覆盖整棵子树，同名的折果要再合并一次，所以 `fold` 交结构化 `data` 而不是文本：文本合并不了。不写 `merge` 时用缺省规则（数量相加、色档取更紧急、`data` 丢弃）。
- 本插件未安装 / 未启用时 `require` 抛错：`try/catch` 兜住即可，不影响你其余功能。
- 同 id 冲突**由来源决胜，与注册顺序无关**（宿主不保证 apply 先后）：提供方恒胜过渡适配器。

### 为什么用 `subscribe` / `getSnapshot`，不用 React hook

徽标是 React 组件，而 hook 调用序列必须逐次渲染恒定。facet 是运行时注册 / 注销的：逐个调提供方的 hook，注册面一变 hook 数量就变，React 直接抛 "Rendered more hooks than during the previous render"。本插件只订阅一次、只读一个版本号，背后挂多少个来源都与 hook 数量无关。

### 过渡期：本插件目前代管的两家

| facet id | 现状 | 提供方要做的 |
|---|---|---|
| `dsh-gitea-dispatch.waiting-review` | 本插件读 `dsh-gitea-dispatch/client` 的摘要 store 代为登记 | 自己注册同 id facet |
| `dsh-later.schedule` | 本插件读 `dsh-later/client` 的摘要 store 代为登记 | 自己注册同 id facet |

两家各自接入后，删除 [`src/client/legacy/`](src/client/legacy) 整个目录与 `package.json` 里对应的两条 `dsh.client.external` 声明即可。在那之前这条路径一直有效，两家不接入也不会坏。

> ⚠️ 跨插件**值导入**在本项目走不通（实测 `Could not resolve "dsh-group-status"`：客户端 bundle 是自包含的闭包工厂），所以提供方只认 `require('dsh-group-status/client')` 拿到的运行时符号，不 `import` 本包的类型。协议形状见文档，抄一份结构声明即可。
---

## 快速开始

### 安装到 DSH

**npm 安装（推荐，预构建产物，无需授权）：**

```bash
dsh plugin --profile web add dsh-group-status
# 重启 dsh web 后生效（侧栏是整包替换，需重新生成浏览器模块）
```

或者从 GitHub 安装：

```bash
dsh plugin --profile web add "github:dsh-plugin-collection/dsh-group-status"
# 重启 dsh web 后生效
```

本机开发时用 link，改完 `src/` 重建即可生效：

```bash
git clone https://github.com/dsh-plugin-collection/dsh-group-status.git
cd dsh-group-status
pnpm install && pnpm build

dsh plugin --profile web add "link:$PWD"
# 重启 dsh web
```

> 开发提示：`pnpm watch` 监听 `src/` 自动重建；但侧栏是整包替换，**改完仍需重启 dsh web**。

### 验证

1. 找一个有进行中 / 待审批会话的分组 → 收起 → 文件夹名后出现徽标；
2. 悬停文件夹行 → 明细行出现（与徽标文案一致）；
3. 展开分组 → 徽标消失，子行自带状态；
4. 浏览器 console 无报错。

### 回滚

```bash
dsh plugin --profile web remove dsh-group-status
# 两条补丁一起撤，官方行自动回来；重启 dsh web 生效
```

---

## 兼容性

| 项 | 值 |
|---|---|
| DSH 内核 | `0.2.0-rc.2` |
| peer 依赖 | `@deepseek-ai/cordis ~4.0.4` |
| 上游基线 | `@deepseek-ai/dsh-client-ui-workspace 0.2.0-rc.2`（源码已 vendored 进本仓库 `src/`）|
| 安装形态 | fork 覆盖包：同槽位注册 + `cordis.patch.yml` 禁用官方行 |
| 可选搭档 | dsh-later（定时任务摘要）、dsh-gitea-dispatch（等待评审摘要）|

上游一换代就得按[升级手册](./docs/upgrading.md) rebase 一次；上游改槽位名、组件签名或上下文契约时，本包不会自动跟上。

---

## 开发

```sh
pnpm install
pnpm build        # tsc 类型检查 + tsdown 打包 → lib/
pnpm watch        # 监听 src/ 自动重建（改完仍需重启 dsh web，侧栏是整包替换）
pnpm test         # = test:node（node --test，12 用例）+ test:spec（vitest + jsdom，96 用例）
pnpm test:spec    # 只跑上游 spec 套件
```

`tests/` 是上游测试副本，外加本仓库自己的 [tests/group-status.client.spec.ts](tests/group-status.client.spec.ts)——它覆盖折叠聚合本身（计数、待处理类互斥、子智能体、空白/归档跳过、跨插件来源）。

上游另有 7 个 spec 只能在 DSH monorepo 里跑：它们要么依赖 `dsh-client-test-runtime` 对**未发布源码**的深导入，要么从已发布的 `…/client` 产物里取运行期值、而那个闭包要求宿主预载整套依赖。本地在 [vitest.config.ts](vitest.config.ts) 顶部显式跳过了它们，原因逐条写在文件里——**不要用假实现把它们点亮**，那只会测试假实现。

---

## 已知限制

- **上游换代必须手工 rebase**：本包 vendored 了上游源码（`src/`、`tests/`），用的不是稳定公共 API；上游动槽位名、组件签名或上下文契约时要跟着改，步骤见[升级手册](./docs/upgrading.md)。
- **每次状态变更多一轮全量测量**：聚合计数与展开态共用同一份派生；为了让折叠的父级算得准，**展开的分组同样要被测量**（它自己不画徽标，但祖先要用它的数字）。超大分组（数百会话）每次状态变更多一轮 traverse + 一次沿树上卷，与展开渲染同量级，可接受；该成本由 `tests/group-status.client.spec.ts` 的 perf 用例守住。
- **状态不自己产生**：跨插件图标完全依赖 dsh-later / dsh-gitea-dispatch 暴露的摘要 API，它们不装就只是没有那两个图标，不影响本体。
- **数字比明细粗**：定时任务按「组内有定时任务的会话数」计，不按任务条数累计；具体条数在 dsh-later 自己的界面上看。
- **只覆盖侧栏折叠态**：本插件只加聚合显示，不改会话状态机、不改行内 badge 的判据。

---

## 技术文档

- [上游升级手册](./docs/upgrading.md) — 基线怎么来的、本地改了哪几处、上游换代时怎么 rebase 与验证
- [跨插件摘要模板](./src/client/cross-plugin-summary.ts) — 提供方（provider）侧骨架本体，文件头就是它的设计说明与「复制、不要 import」的实测依据

## 许可

MIT（沿用上游 `@deepseek-ai/dsh-client-ui-workspace`）。

---

<div align="center">

<img src="icon.svg" width="48" alt="dsh-group-status"/>

</div>
