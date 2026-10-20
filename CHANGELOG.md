# 更新日志

本文件记录面向使用者的重要变更。细粒度提交历史见 git log。

文中 `Issues #NN` 指向本项目内部 Gitea 跟踪器上的条目（该跟踪器不对外，故不附链接）。

## 未发布

## 0.3.0 — 2026-10-20

- **refactor** 删除过渡适配器 `src/client/legacy/`（5 个文件）、`package.json` 的两条 `dsh.client.external` 声明，以及只为它们存在的 5 个文案键（`status.waitingReview` / `...Overdue` / `...Imminent` / `...Left`、`status.scheduled`）。两家已各自注册同名 facet：dsh-gitea-dispatch 走其 PR #51（Issues #47），dsh-later 走其 PR #40（Issues #36）。
- **refactor** `visibleFacets` 从 `legacy/store-source.ts` 移到 `src/client/facet-visibility.ts`：它是徽标自己的可见性规则，不是某个来源的适配。移进 `legacy/` 只是当初为了让它能被测试，现在它本来就该在核心侧。
- **test** 核心用例不再引真实适配器，改用测试自己声明的合成来源。**这是一次所有权校正，不是减少覆盖**：用真实适配器测聚合，等于把「本插件不认识任何来源」这条断言悄悄写成「认识两个」。文案用例改为断言「来源交出的句子逐字呈现、无 label 时兜底且绝不读出来源 id」。删除 `tests/legacy-bridge.client.spec.ts`（被测对象已不存在）；其"store 迟到"与"设置过滤"两条不变量分别由 `tests/facets.node.test.mjs`（登记面语义）与 `tests/badge-labels.client.spec.ts`（过滤后不残留）继续覆盖。
- **docs** `facet-protocol.md` 的过渡一节改写为迁移史，并补两条提供方必读：`require` 只能用工厂注入的那个（全局 `require` 缺席且静默失败）；`protocol` 必须**比对**而不是回声对端版本（回声会关掉版本闸门，使 v1 形状的 facet 能声称 v2 并被接受，之后按错的语义静默渲染）。

### 由 dsh-gitea-dispatch 提出的四个问题（#22 / #23 / #24 / #25）

- **fix** 脉冲作用在**整只**徽标上，同组里任何一家声明 `pulse: true` 就让别家本该静止的图标跟着呼吸（Issues #22）。此前只把**判据**交出去了（`fold.pulse`），**作用对象**仍留在徽标容器上，于是 `pulse: false` 是否生效取决于同组里恰好有没有别人开闪——「等待评审超时不闪」这条承诺（README 与 `badge-labels.ts` 注释都写着）会悄悄失效，而提供方无从发现：它交出了 `pulse: false`、自己的 CSS 里零 `animation`，失效完全发生在本仓库的容器 class 上。现在判据与作用对象一起下沉到**声明它的那个元素**（`facetPulseClass` 取代 `groupBadgeIsUrgent`），计数数字与宿主会话状态点任何时候都不再继承来源的紧急程度。`docs/facet-protocol.md` 同步改写 `pulse` 的语义。
- **fix** 悬停明细不渲染 provider 的图标，只画一个统一 `StateDot`，而写着这件事的注释理由是「紧急程度由文案与**图标色**表达」——明细里根本没有图标色，这个前提不存在（Issues #24）。结果是同一条状态、同一次悬停里，徽标上是红色沙漏、明细里是黄点：徽标与明细是**同一行的两个视图**却各说一套。宿主 `StateDot` 只有 warning / ongoing / done 三档、没有 error 档，所以色档只能由来源自己的图标表达；现在明细行与徽标用**同一个** `facetGlyph` 元素（`HoverStatusLine` 新增可选 `glyph`，provider 未交 `renderIcon` 时两处同款退回通用点）。`docs/facet-protocol.md` 的「已知取舍」改写成与实现一致。
- **refactor** 同一事实两份实现，四处（Issues #25）：
  - **点行顺序 ≠ 明细顺序**，而注释声称两者「完全一致」。徽标是 pending → active → **done** → facet，明细是 pending → active → **facet** → done。点行按明细对齐，注释与实现从此同一条来源。
  - **状态优先级两份实现，结果不同**。徽标计数在 pending 分支里 `continue` 掉 `subagents += n.runningSubagentCount`（行内却给两个点），且未运行但已完成 + 有运行中子智能体时两处判断相反（徽标凭空多一枚绿点并计入数字）——`GroupBadge.tsx` 里「数字 = 进行中（**含子智能体**）」此前是空头承诺。计数判据改为与行内 `sessionStatuses()` 同一套规则，两处分歧各配一条回归测试。**这是行为变更**：折叠徽标的数字可能变大。
  - **一次渲染两个时钟**。`groupLiveBadge` 与 `hoverStatusLines` 各走 `Date.now()` 默认参数，而聚合用一次读数——跨分钟边界时同一行的徽标文案与明细文案可能差 1 分钟，正是 `group-status.ts` 那条不变式想防的事。`ProjectRowItem` 现接收 `now`，由 `WorkspaceBrowser` 统一的读数下发到徽标与明细。
  - `FACET_TONE_RANK` 仍是对外导出的名字但仓库内零使用（真正生效的是 `TONE_ORDER`）——**本次不动，且留作待决**。原先记的理由**经核实不成立**：「删除可能影响 dsh-gitea-dispatch 的产物断言」是错的，对方那条断言是**负向**的（其 `tests/group-status-facet.test.mjs:707`：`assert.equal(built.includes('… FACET_TONE_RANK'), false)`），它只要求「对方的内部件没被打进包」，本仓库删掉这个导出它照样通过。剩下的真实情况是：它从 `src/client/index.ts:157` 导出、第三方技术上能 import，但 `docs/facet-protocol.md` 与两份 README 都没提它，仓库内也没有任何实现读它。所以三选一：让 `defaultMergeFold` 真正用它、删掉这个导出、或把它写进契约文档承认是公共 API。判定过程见 Issues #25 的评论。
  - **后续已收口，选第一项**：`defaultMergeFold` 改读对外的 `FACET_TONE_RANK`，私有的 `TONE_ORDER` 删除（它只有这一个使用者）。两份表的顺序逐项相同，所以对合法色档**零行为变更**（64 种组合逐一比对，0 处分歧）。非法档位靠 `FACET_TONE_RANK[tone] ?? -1` 保住旧性质——`facetRejection` 只校验 protocol / id / 三个方法，**不校验 `fold()` 返回的 `tone`**（那是跨插件边界、运行时才产出的东西），少了这个 `?? -1`，坏 provider 的非法档位会被传播而不是被另一侧的合法档压掉。护栏是 `tests/facets.node.test.mjs` 的两条 #25③ 用例，并已用变异测试验过其非空洞性：删掉 `?? -1` 后「非法色档」那条会红。
- **docs** 设置项标签与 hint（中 / 英）、字段注释、`Config` 注释、`README.md` 两处表格、`README.en.md` 两处表格（图标对照表 + 设置项表）、`docs/upgrading.md` 的升级验收清单里对「等待评审」图标的描述改回与屏幕一致：dsh-gitea-dispatch 自其 #56/#60 起交出自绘沙漏，不再是「列表笔」（Issues #23）。英文表格与升级验收清单是第一轮漏掉的，漏法与它自己要修的那条毛病同一种：zh 改了，而「照着核的人读的那份」没跟上。验收清单里写着一个已经不存在的形状，照它核的人只会得出「插件没生效」。`legacy/register-legacy-facets.tsx` 的 pen 保留为**兜底形状**并注明「仅 provider 缺席时现形，形状不一致是有意接受的」——provider 缺席时让形状与行内不一致，好过「等待评审彻底不进徽标」。
- **test** 新增 5 条用例：脉冲逐来源判定（含邻居开闪不影响 `pulse: false`）、明细取来源图标及其缺省兜底、点行与明细同序、同一 `now` 决定倒计时读数、#25② 的两处优先级分歧各一条 + 一条「无子智能体的已完成仍照常计入」的反向保护。

- **fix** 入库的构建产物比源码陈旧：`lib/types/index.js`（`tsdown` 的打包入口）比 `src/index.ts` 少 6 个配置项，导致发布出去的 `lib/index.js` 里 `Config` 只有 `showCompletedInBadge` 一个字段——**设置界面因此只画得出 1 个开关**，其余 6 项（进行中 / 待审批 / 定时任务 / 等待评审 / 悬停明细 / 数字阈值）在界面上无法配置。徽标行为不受影响（客户端对这些字段有「缺失即回落默认」的兜底），受影响的是可配置性。根因是 `tsc` 的 `incremental` 缓存（`lib/tsconfig.tsbuildinfo`）陈旧后**静默跳过输出且退出码为 0**，产物便一直停在旧版本。已全量重建 `lib/`，并新增 `tests/artifacts.node.test.mjs` 锁住「产物存在性 + `Config` 字段与源码对齐」，同时把全量重建的写法补进 `docs/upgrading.md`。
- **feat** 跨插件状态改为**协议**：本插件不再逐家适配，改由状态所有者注册 facet。新增 `src/client/facets.ts`（协议 v1 + 登记面）与 `docs/facet-protocol.md`（契约文档），client 入口导出 `registerGroupStatusFacet` / `GROUP_STATUS_FACET_PROTOCOL_VERSION`。加一个新状态源，本插件**零改动**。
- **refactor** 聚合与渲染去掉所有按来源写死的分支：`GroupLiveStatus` 不再有 `scheduled*` / `waitingReview*` 具名字段，改持 `facets: Map<id, {facet, fold}>`；徽标的数字取各来源自报的 `count` 之和，图标取来源自带的 `renderIcon`（缺则按 `tone` 退通用点），文案取 `label`（缺则「N 需要关注」，绝不把内部 id 念给用户），脉冲取 `pulse`。
- **refactor** 消费侧不再逐个调提供方 hook。facet 运行时可增删，而同一组件的 hook 序列必须恒定，逐个调会在注册面变化时直接抛 "Rendered more hooks than during the previous render"。改为订阅一个聚合外部存储 + 读版本号，与来源数量无关。
- **feat** 同 id 冲突由**来源**决胜而非注册顺序（宿主不保证 apply 先后）：`provider` 恒胜过渡适配器 `legacy`，低一方的登记被拒并在 console 点名。
- **fix** 登记面的通知改为**合并补跑**而非递归：订阅者在回调里再登记会嵌套递归（两个互相触发的订阅者即无界），且中间那轮看到的登记面是改到一半的。
- **fix** 未声明 `order` 的来源排在所有声明过之后（彼此按注册先后）。原先缺省为 `0`，新接入的陌生来源会插到既有状态前面抢视觉位置。
- **refactor** 过渡适配器的可测部分拆到 `src/client/legacy/store-source.ts`（纯函数）：与图标同文件的逻辑在本仓库根本 import 不动（`vitest.config.ts` 排除理由 (b)），"store 迟到"和"设置关掉哪个来源"这两处真会咬人的逻辑此前测不到。
- **test** 新增协议契约用例：`tests/facets.node.test.mjs`（校验、决胜、注销语义、排序、重入合并、缺省合并）与 `tests/legacy-bridge.client.spec.ts`（设置过滤、store 迟到与替换、提供方缺席、订阅接线）；`tests/badge-labels.client.spec.ts` 改为经真实适配器驱动，锁住"陌生来源不写分支也能读出来"。
- **chore** 新增文案键 `status.needsAttention`（中 / 英）。

- **fix** 对 dsh-gitea-dispatch 的适配只做了一半：徽标只消费它发布的 `state`，其余字段全丢。提供方按 issue #16 发布的条目是 `{ prNumber, state, startedAt?, waitMaxSec?, deadline? }`，本插件的接收类型只声明 `{ prNumber, state }`，于是「在等哪个 PR」「还要等多久」「窗口缺失」三件事到不了界面。现在悬停明细与 `aria-label` 带上 PR 号与剩余时长（分钟粒度：徽标只在提供方 store 通知时重渲染，秒级读数会停在旧值上撒谎），窗口缺失时照实说「等待评审」，不编造倒计时。实测：注入一条 `PR #990002` 的等待登记后，折叠的 `dsh-plugins` 徽标由 `1 进行中 · 1 等待评审 · 1 定时任务` 变为 `1 进行中 · 1 等待评审（剩 2分钟） · #990002 · 1 定时任务`；把等待窗口改成已过期则变为 `…（已超时）…`。
- **fix** `waiting` 与 `overdue` 此前只有颜色不同，文案都是「等待评审」。这与本插件自己为定时任务与等待评审选用不同图标的理由（只靠颜色区分对色盲用户不可用）自相矛盾，也丢掉了提供方算出来的状态。现在两者各有一句文案：`等待评审` 与 `等待评审（已超时）`。
- **fix** 等待评审超时不再触发徽标脉冲。数据所有者把 `overdue` 的会话行图标画成静止（其 `lib/waiting-glyph.js` 写明「超时后停动画：静止即不再期待，比继续闪动更能表达已经结束」），且其 `overdue` 只代表 CI 的等待窗口到期、不代表评审失败。同一条等待在行内静止、在父级徽标闪动，就是同一事实的两种说法。红色不变。判据抽成纯函数 `groupBadgeIsUrgent()`，定时任务的 overdue/urgent 仍脉冲。（该判据已在上面的 #22 条里进一步下沉到单个元素，`groupBadgeIsUrgent` 由 `facetPulseClass` 取代。）
- **refactor** 分组折叠交给提供方：能用到 `summarizeWaitingGroup()` 就用它（id 口径、状态排序、截止时刻算法都归它所有），缺失时才退回本仓库的等价实现 `summarizeWaitingGroupLocally()`。此前本插件自己重写了一遍查表，且比提供方少两条兜底（`session-` / `webhook-` 前缀形态），只会静默 miss；现在与 `cross-plugin-summary.ts` 的 `entryFor()` 共用同一条四形态规则。
- **refactor** 徽标文案拆到 `src/client/badge-labels.ts`（纯函数，零运行时 import）。`rows/GroupBadge.tsx` 引入宿主图标集，其 `require` 图只在 DSH 应用内解析得到（`vitest.config.ts` 排除理由 (b)），文案留在原地等于这批跨插件状态永远测不到。新增 `tests/badge-labels.client.spec.ts` 11 例锁住文案与脉冲判据。
- **feat** 等待评审的事实随多层聚合正确上卷：PR 号取并集、去重、升序，倒计时取组内最早的未到期截止（一侧无窗口不会抹掉另一侧的）。多个会话等同一个 PR 时，明细只写一次 `#15`。

## 0.2.2 — 2026-10-15

- **feat** 多层聚合：父分组折叠时，徽标聚合所有后代分组的会话状态，不再只看直接成员。嵌套的 workspace 目录结构现在能正确反映整棵子树的活动。
- **fix** 上面这条「多层聚合」交付时是坏的：折叠的父文件夹会**漏算处于展开状态的中间层文件夹**的会话。`directStatusesForGroups` 沿用了「展开即 `EMPTY_LIVE_STATUS`」的占位写法，而聚合器把这个值当输入消费，于是展开的中间层对祖先贡献 0。现在展开的分组同样被测量，「不画徽标」退回渲染层决定。实测：dsh-group-status 展开且 1 个运行中、dsh-gitea-dispatch 1、dsh-later 3 时，dsh-plugins 的折叠徽标由 `4` 修正为 `5`。
- **fix** 折叠文件夹时完全没有淡出动画。`AnimatedRows` 的 `resetKey` 混入了 `sessionLimits`，而上游在折叠时会把该组的 limit 重置回默认值 → `resetKey` 变化 → 动画被整个跳过。属上游行为（vendor 基线 `d70ad82`），非本仓库引入。副作用：「展开其余 N 个会话」现在也会淡入而非瞬时呈现。
- **test** 徽标管线的测试此前是**自欺**的：`groupOf()` 在测试里手工赋值 `group.liveStatus`，而那份手工副本编码的正是上面第一个错误语义——所以少算 bug 能一路绿灯合入。改为走真实管线 `deriveGroups → directStatusesForGroups → aggregateGroupStatuses`，并给聚合路径补上全折叠 / 全展开两侧的 perf 护栏。变异验证：把 bug 塞回去，红 6 个测试（此前 0 个）。
- **refactor** 未经聚合的行现在在类型上不可表示：`StatusedGroupNode`（`liveStatus` 必填）+ `withAggregatedStatus` 生产者。上游的 `GroupNode.liveStatus?` 与 vendored 文件的签名均未改动。
- **refactor** 删掉 `tree.ts` 里无人使用的 re-export（两个值只有测试在用，4 个跨插件 summary 类型零消费方）。`tree.ts` 相对上游基线的新增分歧 31 → 18 行。
- **docs** 修正 README 的徽标数字公式：漏了「运行中的子智能体」一项，且「有徽标就带数字」与 `countThreshold` 默认值 2 自相矛盾。
- **perf** 代价说明：为正确性放弃了「展开的分组跳过聚合计算」这一优化，展开分组现在也会被测量（折叠祖先需要它的数字）。该成本由新增的 perf 用例守住。
- **feat** 设置项从 1 个扩展到 7 个：5 个按状态显隐（进行中 / 待审批 / 已完成 / 定时任务 / 等待评审）+ 悬停明细开关 + 数字显示阈值。设置卡片分 3 个 section，每个开关独立控制对应来源的点/图标是否出现在折叠徽标、悬停明细与计数中。
- **feat** 数字显示阈值（`countThreshold`）：取代原来的布尔开关 `alwaysShowCount`。现在可以设置一个数字阈值，只有当聚合数量 >= 该阈值时才在徽标上显示数字。默认 2（即 count=1 时省略，因为状态点已表达"有东西"）；设为 1 则始终显示；设为 3 则 count=1 和 count=2 时都不显示。
- **fix** 设置项 `showCompletedInBadge` 在 GUI 里根本没有入口：宿主只把 `Config` 投影成客户端表单，插件页要插件自己往 `plugins.bundle.config` 注册卡片才画得出来。现在侧栏 **插件** → dsh-group-status 的 bundle 详情页有这张卡片，保存后写进 profile patch 并即时生效。外观与交互不自造——用官方 `SettingsForm` / `SettingsFormModel` / `Switch`，与「插件 → 官方 → 子智能体」同一套框架与取值。README 此前描述的路径是文档超前于实现，文案与升级手册已同步。
- **test** 新增字段规格（真实现）与卡片接线（官方组件契约等价桩）用例。

## 0.2.1 — 2026-10-15

与 0.2.2 同一分钟内发布（npm `08:02:01Z` / `08:02:48Z`），**仓库里没有对应提交，也没有 tag**：
`git log -S'"version": "0.2.1"' -- package.json` 零命中。两个版本的 tarball 也不同（unpacked 1390616 vs
1244786 字节），所以 0.2.1 的确切内容无法从仓库重建 —— 此处只如实记录这个缺口，不据猜测填写条目。

## 0.2.0 — 2026-10-12

首个正式发布。内容与下面的 `0.2.0-rc.2-fork1` 相同（unpacked 1269018 vs 1269025 字节，差值即版本号本身；
`files` 字段一致），特性清单见该小节。

## 0.2.0-rc.2-fork1

- **feat** 折叠分组聚合徽标：收起的文件夹行显示进行中（转圈）、待审批（黄点）、已完成（绿点）的聚合状态，带数字与悬停明细。
- **feat** 跨插件聚合（可选）：接入 dsh-later 定时任务（时钟图标）与 dsh-gitea-dispatch 等待评审（列表笔图标），未安装时静默降级。
- **feat** 设置项 `showCompletedInBadge`：可关闭折叠徽标上的「已完成」绿点，默认开启。
- **feat** 无障碍：徽标带 `role="img"` + 本地化 `aria-label`，悬停 `title` 同文案。
- **refactor** 拆分 `badge-settings` / `group-status` 模块，新增 `GroupBadge` 组件。
- **refactor** 上游 `tree.ts` / `Rows.tsx` 代码下沉，侧栏展开态与官方版本逐像素一致。
- **docs** 中英双语 README + 上游升级手册 + 跨插件摘要模板说明。
- **test** 上游 spec 本地可跑（vitest + jsdom），新增折叠聚合用例（计数、待处理类互斥、子智能体、空白/归档跳过、跨插件来源）。
