# 分组状态 facet 协议 v1

折叠分组的徽标由本插件画。任何插件想让自己的状态出现在那只徽标上，就按本文注册一个
facet。**本插件不需要为你的插件改任何代码**。

这份文档是契约。改它要升版本号，并同时通知已接入方。

## 你要实现什么

一个对象，六个成员，三个必填：

```ts
import { createElement } from 'react'

const groupStatus = require('dsh-group-status/client')

const unregister = groupStatus?.registerGroupStatusFacet?.({
  protocol: groupStatus.GROUP_STATUS_FACET_PROTOCOL_VERSION, // 必填，1
  id: 'my-plugin.review',                                    // 必填，'<包名>.<状态名>'
  subscribe: store.subscribe,                                // 必填，外部存储订阅面
  getSnapshot: store.getSnapshot,                            // 必填，读当前快照
  fold: (snapshot, sessionIds, now) => ({                    // 必填，折成这一组的事实
    count: snapshot?.size ?? 0,
    tone: 'warn',
    pulse: false,
    data: snapshot,
  }),
  merge: (a, b) => ({ ... }),                                // 可选，多层文件夹怎么合并
  label: (fold, { now }) => `${fold.count} 在等评审`,          // 可选，进 aria-label 与明细
  renderIcon: (fold) => createElement('svg', { /* ... */ }),  // 可选，图标
  settingKey: 'showWaitingReviewInBadge',                    // 可选，受本插件哪个开关管
  order: 20,                                                 // 可选，图标排列顺序
})

ctx.effect(() => () => unregister?.(), 'my-plugin: group status facet')
```

只交必填三项也能跑：徽标会显示「N 需要关注」加一个按色档取色的通用点。**不会**把你的
内部 id 念给用户。

## 为什么是这个形状

三处设计取舍都有具体原因，改之前请先读完这一节。

### 为什么是 `subscribe` / `getSnapshot`，不是 React hook

徽标是 React 组件。上一版让每家导出一个 `useXxxSummary()`，本插件在同一个组件里
逐个调。这条路不成立：

- **同一组件里 hook 调用序列必须逐次渲染恒定**，而 facet 是运行时注册 / 注销的。注册面
  一变，hook 数量就变，React 直接抛 "Rendered more hooks than during the previous
  render"。
- 本插件因此必须在编译期知道"有几个来源、各叫什么"，正是要消掉的耦合。

`subscribe` / `getSnapshot` 是同一能力的非 React 形态（宿主 `useSyncExternalStore`
的外部存储面）。本插件只订阅一次、只读一个版本号，背后挂多少个来源都与 hook 数量无关。

### 为什么 `fold` 要返回 `data`，而不是直接返回可渲染文本

折叠的父文件夹要覆盖整棵子树，而子树里每一层都已各自 `fold` 过一次，所以本插件必须把
同名的折果**再合并**一次。文本合并不了：「剩 3分钟」和「剩 5分钟」拼起来不是答案。
结构化 `data` 能合并，合并规则由你提供（`merge`），文案在渲染时刻由你的 `label` 现算。

本插件从头到尾**不解释 `data`**。它是你的私有形状。

### 为什么图标和文案归你

「这个状态长什么样、超时该静止还是该闪」是状态所有者的知识。上一版本插件按状态名反推，
结果与你的判断相反：你把 `overdue` 画成静止（「静止即不再期待」），徽标却在同一件事上
脉冲，同一个事实在同一屏里出现两种说法。

`renderIcon` 返回**已含配色**的 React 元素。不提供时本插件按 `tone` 退回一个通用点。

## 成员逐条

| 成员 | 必填 | 语义 |
|---|---|---|
| `protocol` | 是 | 必须是 `GROUP_STATUS_FACET_PROTOCOL_VERSION` 的原值。对不上会被拒绝登记并在 console 点名。 |
| `id` | 是 | 全局唯一，建议 `'<包名>.<状态名>'`。它同时是 React key 和同 id 冲突的判据。 |
| `subscribe(listener)` | 是 | 快照可能变化时调用 `listener`；必须支持多个订阅者；返回退订函数。 |
| `getSnapshot()` | 是 | 当前快照。还没拿到数据时返回 `undefined`，本插件按"此刻无贡献"处理。 |
| `fold(snapshot, sessionIds, now)` | 是 | 纯函数。同样的三个入参必须给出等价结果：它在每次渲染里被调用，不该有副作用。 |
| `merge(a, b)` | 否 | 合并同名 facet 在两层的折果。不提供时用缺省规则（见下）。 |
| `label(fold, { now })` | 否 | 进徽标 `aria-label` / `title` 与悬停明细的那句话。返回空串按"我没有文案"处理。 |
| `renderIcon(fold, { now })` | 否 | React 元素，自带配色。 |
| `settingKey` | 否 | 受本插件哪个开关控制。省略 = 始终参与。 |
| `order` | 否 | 图标排列顺序，升序。**缺省排在所有声明过 `order` 的来源之后**，彼此按注册先后。 |

### `FacetFold`

```ts
{
  count: number                            // 进徽标数字的条数；<= 0 时该来源整块跳过
  tone: 'info' | 'warn' | 'error'          // 语义色档（本插件据此取色令牌）
  pulse: boolean                           // 你这一条要不要脉冲（#22：作用在你自己的图标上）
  data?: unknown                           // 你的私有形状，本插件从不读
}
```

`count` 是你对徽标数字的贡献。你的 `label` 应当与它口径一致（徽标显示 2，明细写 3，
用户会认为界面在撒谎）。

**`pulse` 只作用于你交出的那一枚图标**（#22），不作用于整只徽标：同组里别家声明 `pulse:
true` 不会让你的图标跟着呼吸，你声明 `pulse: false` 也不会因为邻居开闪而失效。计数数字与
宿主会话状态点**任何时候都不闪**——它们不是你的状态，就不该继承你的紧急程度。

### 缺省 `merge` 与它不做什么

不声明 `merge` 时：`count` 相加、`tone` 取更紧急的一档、`pulse` 取或，并且**丢弃
`data`**（本插件不知道如何合并你的私有形状）。需要 `data` 跨层生效（PR 号并集、最早
截止时刻之类）就必须自己实现 `merge`。

## 同 id 冲突：由来源决胜，与注册顺序无关

宿主不保证插件 apply 的先后。所以：

| 已登记 | 新来的 | 结果 |
|---|---|---|
| 你的（`provider`，缺省） | 代管者（`legacy`） | 代管被拒，不覆盖你 |
| 代管者（`legacy`） | 你的 | 你覆盖它 |
| 同来源重复登记 | 同来源 | 直接覆盖（热替换不必先注销） |

`origin` 字段你**不用填**，缺省即 `provider`。过渡适配器会显式写 `'legacy'`。

## 生命周期与降级

- **返回的注销函数**挂到 `ctx.effect` 的清理上。宿主卸载你的插件时它会跑。
- **本插件未安装 / 未启用**：`require('dsh-group-status/client')` 抛错。必须 `try/catch`
  或 `?.` 兜住，视为"没有徽标可登记"，不要因此影响你自己的功能。
- **本插件后加载**：模块表行在你 `require` 时才 materialize，注册面是模块级单例，所以
  你的登记不会丢。
- **你的 store 迟到**：这是你内部的事。把"store 刚创建出来"也当作一次 `listener()`
  通知，否则徽标要等到下一次轮询才出现，而且没有任何报错线索。
- **快照读失败 / `fold` 抛错**：本插件跳过这一个来源，不拖累徽标其余部分。

## 版本规则

- `protocol` 对不上 → **拒绝登记**并在 console 点名（不静默忽略：「我注册了为什么没
  显示」必须能查）。
- 加**可选**成员、加新的 `tone` 取值：不升版本。
- 改必填成员、改任何成员的语义：升版本，并在本文变更记录里写明迁移步骤。

## 迁移史：`legacy/` 已删除

本插件一度为两家代管（`origin: 'legacy'` 的过渡适配器）。两家已各自注册同名 facet，
代管目录与 `package.json` 里对应的两条 `dsh.client.external` 声明随后删除：

| facet id | 归属 | 接入位置 |
|---|---|---|
| `dsh-gitea-dispatch.waiting-review` | dsh-gitea-dispatch | `client/group-status-facet.js`（其 Issues #47 / PR #51） |
| `dsh-later.schedule` | dsh-later | `src/client/group-status-facet.ts`（其 Issues #36 / PR #40） |

保留 `FacetOrigin` / `FACET_ORIGIN_RANK` 不是为已经删掉的代管留兼容：它是**任何一次迁移**
的安全网。下次再需要临时代管某个来源时，注册方与所有者仍不必协商发布顺序。

### 提供方必读：`require` 只能是注入的那一个

宿主给闭包工厂注入 `require`（`window.__ModuleLoader__.load({ factory: (require) => ... })`），
但**没有全局 `require`**（实测 `typeof globalThis.require === 'undefined'`）。用全局写法不会
报错，只会拿到 `undefined`，于是整条跨插件集成「看起来装着、其实一直没工作」。必须用工厂
注入的那个，并且 `try` / `?.` 兜住对端缺席。

### 提供方必读：`protocol` 要比对，不要回声

版本常量填**你自己实现的那个**，并在登记前比对对端声明的版本；不一致就留一条可见日志并
放弃登记。把对端的数字原样抄进 `protocol` 看似更聪明（「对方说几就是几」），实际会关掉
版本闸门的唯一作用：将来对端升到 v2 且改了某个既有成员的语义时，你这份 v1 形状的 facet
会声称自己是 v2 并被接受，徽标从此按错的语义渲染，而且没有任何一处会报错。沉默的等价
正是这份文档反复要消灭的那类失败。

## 已知取舍

- **新 facet 默认没有用户开关**。`settingKey` 只能挂到本插件已有的布尔开关上。两条路：

  - **省略 `settingKey`（推荐）**：你的来源始终参与徽标，本插件**零改动**。缺省是"显示"，
    与其余开关的默认值同源，所以这不是降级路径，而是常态路径。
  - **要一个独立开关**：需要在**本插件**加一个布尔设置项。成本不是"一处声明"，实测是
    **14 个改动点、5 个文件**（10 处代码 + 4 条文案）：`src/index.ts`（schema 字段 +
    `Config` 接口）2 处、`src/client/badge-settings.ts`（接口 + 默认值 + 相等判断 +
    resolve）4 处、`src/client/badge-field.ts`（`BADGE_FIELDS` + 字段 spec +
    `ALL_BADGE_FIELDS`）3 处、`src/client/BadgeSettingsCard.tsx`（一行 `<ToggleRow>`）
    1 处、`src/client/locales.ts`（zh/en 各一条 label + hint）4 条字符串。

  这个成本是**已知设计债**，根因是 `Config` 在服务端静态声明、而 facet 在客户端运行时注册，
  两边永远错开一个时序。收口的方向是把这 N 个布尔换成一个泛化字段
  （`facetToggles: Schema.dict(string, boolean)`，声明一次后不再改动，设置卡片改为遍历
  registry 渲染），读取路径其实已经动态了——`facetVisibleBySettings` 收的是 `string`、
  运行时查表、未知键回落 true，且这两个既有开关在全仓库只有 `visibleFacets` 一个功能读取点。
  尚未实施是因为它需要协议新增一个可选的 `settingName`（设置项标题不能复用 `label`，那是
  状态句子），并要求对已持久化的旧布尔做迁移；在出现第三个来源之前，这笔成本不划算。
- **宿主会话状态在明细里只有 warning / ongoing / done 三档点**（这三档是宿主的语义，本
  插件无权增减）。**外部来源不适用这条限制**：`renderIcon` 交出的图标在徽标与悬停明细两
  处都会渲染，所以 `tone: 'error'` 由你自己的图标色档表达，不靠文案自救（#24）。没交
  `renderIcon` 的来源在明细里退回 warning 点。
- **倒计时精度到分钟**。徽标只在你的 store 通知时重渲染，秒级读数会停在旧值上撒谎。
  要秒级就需要本插件为文案装一个定时器，那会破掉"零额外轮询、零额外计时器"的形态。
