/**
 * 分组状态 **facet 协议**：本插件对外提供的唯一接入面。
 *
 * ## 为什么是这个方向
 *
 * 折叠分组的徽标要把「组内有没有别的插件的状态」折成一个数字。此前是**本插件逐家
 * 适配**：`require('dsh-later/client')`、`require('dsh-gitea-dispatch/client')`，再把
 * 各家的字段翻成自己的类型。那个方向的代价已经实测过一次：提供方把 `deadline` /
 * `waitMaxSec` / `prNumber` 发出来了，本插件的接收类型只声明了两个字段，于是信息
 * **静默丢失**（编译不报错、运行不报错、测试不报错，见 CHANGELOG 0.2.3「适配只做了一半」）。
 *
 * 现在方向反过来：**状态的所有者把自己的事实注册进来**，本插件只认协议形状。
 * 新增一个状态源，本插件一行都不改。
 *
 * ```ts
 * // provider 侧（在自己的 apply 里）
 * const groupStatus = require('dsh-group-status/client')
 * groupStatus?.registerGroupStatusFacet?.({
 *   protocol: 1,
 *   id: 'my-plugin.review',
 *   subscribe: store.subscribe,
 *   getSnapshot: store.getSnapshot,
 *   fold: (snapshot, sessionIds, now) => ({ count, tone, pulse, data }),
 *   merge: (a, b) => ({ ... }),
 *   label: (fold, now) => '等待评审（剩 3分钟） · #15',
 *   renderIcon: (fold) => h('svg', …),
 * })
 * ```
 *
 * ## 为什么用 `subscribe` / `getSnapshot` 而不是 React hook
 *
 * 上一版让每家导出一个 hook，本插件在同一个组件里 `useXxxHook?.()` 调。两条都不成立：
 *
 * 1. **hook 数量必须逐次渲染恒定**，而 facet 是运行时注册/注销的：注册面一变，同一个
 *    组件的 hook 调用序列就变了，React 直接抛 "Rendered more hooks than during the
 *    previous render"。
 * 2. 本插件因此必须知道"有几个 facet、各叫什么"——正是想消掉的那个耦合。
 *
 * `subscribe` / `getSnapshot` 是同一份能力的非 React 形态（宿主
 * `useSyncExternalStore` 的外部存储面），一个通用订阅器就能覆盖任意多个 facet。
 *
 * ## 为什么 `fold` 返回 `data`，而不是返回可渲染文本
 *
 * 多层文件夹要把同一个 facet 在子树各层的折叠结果**再合并**一次。文本合并不了
 * （「剩 3分钟」和「剩 5分钟」拼起来不是答案），结构化 `data` 能合并——合并规则归
 * facet 自己（{@link GroupStatusFacet.merge}），渲染时刻再由
 * {@link GroupStatusFacet.label} 现算文案。本插件全程不解释 `data`。
 *
 * ## 兼容性
 *
 * 协议带 `protocol` 版本号。本插件只接受
 * {@link GROUP_STATUS_FACET_PROTOCOL_VERSION} 的 facet，其它版本**拒绝注册**并在
 * console 点名（静默忽略会让"我注册了为什么没显示"变成不可诊断的问题）。
 *
 * @module dsh-group-status/client/facets
 */
import type { ReactNode } from 'react'

/** 本协议文件的协议版本。provider 必须原样填这个常量。 */
export const GROUP_STATUS_FACET_PROTOCOL_VERSION = 1

/** 徽标可用的三档语义色（本插件的色板；provider 选档，不选具体颜色）。 */
export type FacetTone = 'info' | 'warn' | 'error'

/** tone 之间的优先级（越大越紧急），用于多层合并时取更高档。 */
export const FACET_TONE_RANK: Readonly<Record<FacetTone, number>> = Object.freeze({
  info: 0, warn: 1, error: 2,
})

/**
 * 一个 facet 在**一组会话**上折出来的事实。
 *
 * 字段是本插件与 provider 之间唯一的运行时契约：`count` 进徽标数字，`tone` 选色，
 * `pulse` 决定要不要脉冲，`data` 归 provider 自用（本插件从不读它）。
 */
export interface FacetFold<Data = unknown> {
  /**
   * 贡献给徽标数字的条数。`0` 表示这个来源此刻不参与徽标（本插件会跳过它，
   * 不画图标、不进文案）。
   */
  count: number
  /** 语义色档。 */
  tone: FacetTone
  /** 是否脉冲。紧迫感由状态所有者判定，不由徽标反推。 */
  pulse: boolean
  /** 合并与文案所需的原始事实，形状由 facet 自定。 */
  data?: Data
}

/** {@link GroupStatusFacet.label} / {@link GroupStatusFacet.renderIcon} 的渲染上下文。 */
export interface FacetRenderContext {
  /** 渲染时刻（epoch ms）。用于把 `data` 里的截止时刻换算成「还剩多久」。 */
  now: number
  /**
   * 侧栏行的翻译位（本插件的 `workspace` 命名空间）。
   *
   * ⚠️ 这是**便利项，不是义务**：provider 若有自己的 locale 命名空间，应当闭包自己
   * 的翻译函数、忽略这里。这个字段是为**代管方**（`origin: 'legacy'`）复用本插件的行
   * 文案而存在的；内置适配器已删除（迁移史见 `docs/facet-protocol.md`），字段保留给下一次代管。
   */
  t: (key: string, options?: Record<string, string | number>) => string
}

/** 一个注册进来的状态源。 */
export interface GroupStatusFacet<Input = unknown, Data = unknown> {
  /** 必须是 {@link GROUP_STATUS_FACET_PROTOCOL_VERSION}。 */
  readonly protocol: number
  /**
   * 全局唯一 id，建议 `'<包名>.<状态名>'`（如 `'dsh-gitea-dispatch.waiting-review'`）。
   * 它同时是 React key 与重复注册的判据。
   */
  readonly id: string
  /**
   * 外部存储订阅面（宿主 `useSyncExternalStore` 的第一参数）。
   *
   * 必须在快照可能变化时被调用，并且**允许多个订阅者**；返回退订函数。
   */
  subscribe(listener: () => void): () => void
  /** 当前快照；还没拿到数据时返回 `undefined`（本插件会把该 facet 当作无贡献）。 */
  getSnapshot(): Input | undefined
  /**
   * 把快照折成这一组会话上的事实。
   *
   * 纯函数要求：同样的 `(snapshot, sessionIds, now)` 必须给出等价的折果——
   * 它在每次渲染里被调用，不该有副作用。
   * @param snapshot - {@link getSnapshot} 的结果。
   * @param sessionIds - 组内会话 id（含前缀形态；口径归 provider 判定）。
   * @param now - 本次折叠的时刻（epoch ms）。
   */
  fold(snapshot: Input | undefined, sessionIds: readonly string[], now: number): FacetFold<Data>
  /**
   * 合并同一 facet 在子树各层的折果（多层文件夹）。
   *
   * 缺省实现按 `count` 相加、`tone` 取更紧急的一档、`pulse` 取或；facet 若需要
   * 合并自己的 `data`（例如 PR 号并集、最早截止时刻）就必须覆盖它。
   */
  merge?(a: FacetFold<Data>, b: FacetFold<Data>): FacetFold<Data>
  /**
   * 徽标 `aria-label` / `title` 与悬停明细里的那句话。
   *
   * 由 provider 自己本地化（用它自己的 locale 命名空间）；本插件不参与措辞。
   * 返回空串视为「这个 facet 没有可显示文案」，只保留数字贡献。
   */
  label?(fold: FacetFold<Data>, context: FacetRenderContext): string
  /**
   * 图标。provider 交出**已含配色**的 React 元素（它最懂自己的状态该怎么画，
   * 包括"超时该静止还是该闪"这类视觉语义）。
   *
   * 不提供时，本插件退回一个按 `tone` 取色的通用点。
   */
  renderIcon?(fold: FacetFold<Data>, context: FacetRenderContext): ReactNode
  /**
   * **已废弃（v1 保留字段，本插件不再读取）**。
   *
   * 原语义是"我受本插件哪个布尔开关管"（如 `'showWaitingReviewInBadge'`）。但那等于把
   * 别人家的域名与图标形状写进本插件的配置面，与「本插件不认识任何具体来源」直接矛盾，
   * 那两个字段也已经从 `Config` 删除。
   *
   * 现在的规则只有一条：**登记即显示，不注册即不显示**。要给用户一个"关掉它"的开关，
   * 请加在**你自己的**配置卡片里，关掉时不注册 facet —— 显隐是来源自己的产品决定，
   * 只有你知道关掉它意味着什么。
   *
   * 保留而不删除是为了让已接入的提供方**不必同步改版本**：填了它不会报错，也**不会**
   * 再影响任何显示。看到它请直接从你的 facet 里删掉。
   *
   * @deprecated 本插件不再读取；显隐由 provider 决定是否注册。
   */
  settingKey?: string
  /**
   * 渲染顺序（升序）。**缺省排在所有声明过 `order` 的来源之后**，彼此按注册先后，
   * 这样新接入的陌生来源不会插到既有状态前面抢视觉位置。
   */
  order?: number
  /**
   * 来源标记。**provider 不用填**（缺省即 `provider`）。
   *
   * 代管某个来源的一方显式写 `'legacy'`，用它声明「我是在替状态所有者代管」，从而在
   * 对方接入同名 facet 时自动让位。本插件目前不代管任何来源，这条规则为**下一次**迁移
   * 保留。见 {@link FACET_ORIGIN_RANK}。
   */
  origin?: FacetOrigin
}

/** 协议来源：`provider` = 状态所有者自己注册；`legacy` = 替状态所有者代管的注册方（本插件目前不代管任何来源）。 */
export type FacetOrigin = 'provider' | 'legacy'

/**
 * 同 id 冲突时**由来源决胜，与注册顺序无关**。
 *
 * 宿主不保证插件 apply 的先后。过渡期内"本插件代 provider 写的适配器"与"provider
 * 自己注册的 facet"会撞同一个 id：若靠顺序决胜，同一份部署今天显示、明天不显示。
 * `provider` 恒胜 `legacy`：所有者一接入，代管方立刻让位，且不重复计数。迁移因此
 * 不需要协商发布顺序。
 */
export const FACET_ORIGIN_RANK: Readonly<Record<FacetOrigin, number>> = Object.freeze({
  legacy: 0, provider: 1,
})

/** 一个 facet 的来源；缺省按 `provider`（最保守的假设：别人主动注册就是所有者）。 */
export function facetOrigin(facet: { readonly origin?: FacetOrigin }): FacetOrigin {
  return facet.origin === 'legacy' ? 'legacy' : 'provider'
}

/** 任意来源的 facet / 折果：聚合与渲染侧使用的**非泛型**形态。
 *
 * 协议对 provider 是泛型的（它能拿到自己的 `data` 类型），但登记面、折果表、渲染层
 * 都不关心 `data` 是什么，所以内部一律用这两个别名。方法用**方法语法**声明，于是
 * 具体 facet 的 `fold` / `merge` 在这些位置上是可赋值的（双变），不需要 `as never`。
 */
export type AnyFacet = GroupStatusFacet<unknown, unknown>
export type AnyFacetFold = FacetFold<unknown>

/** 一个已登记 facet 及其排序位。 */
export interface RegisteredFacet {
  facet: AnyFacet
  /** 注册序号，作为 `order` 相同时的稳定 tie-break。 */
  sequence: number
}

/** {@link registerGroupStatusFacet} 的失败原因。 */
export type FacetRejection =
  | 'not-an-object'
  | 'protocol-mismatch'
  | 'missing-id'
  | 'missing-methods'
  /** 同 id 上已有更高来源的登记（过渡期适配器被状态所有者顶掉） */
  | 'superseded'

/** 注册结果：成功带 `id`，失败带原因（且**不**静默丢弃）。 */
export type FacetRegistration = { ok: true; id: string } | { ok: false; id: string; reason: FacetRejection }

/** 退订/注销函数。 */
export type Unregister = () => void

// #25③：此处原有 `const TONE_ORDER = ['info','warn','error']`，与对外导出的
// `FACET_TONE_RANK` 是同一个事实的两份实现，且只有 `defaultMergeFold` 一个使用者。
// 现已统一到 `FACET_TONE_RANK`（见该函数），私有那份删除。

/**
 * 检查一个 facet 是否符合协议 v1。
 * @returns 拒绝原因；`undefined` 表示可用。
 */
export function facetRejection(facet: unknown): FacetRejection | undefined {
  if (typeof facet !== 'object' || facet === null) return 'not-an-object'
  const candidate = facet as Partial<GroupStatusFacet>
  if (candidate.protocol !== GROUP_STATUS_FACET_PROTOCOL_VERSION) return 'protocol-mismatch'
  if (typeof candidate.id !== 'string' || candidate.id === '') return 'missing-id'
  if (
    typeof candidate.subscribe !== 'function'
    || typeof candidate.getSnapshot !== 'function'
    || typeof candidate.fold !== 'function'
  ) return 'missing-methods'
  return undefined
}

/**
 * 缺省折果合并：数量相加、色档取更紧急的一档、脉冲取或。
 *
 * ⚠️ 它**不**合并 `data`（本插件不知道 `data` 是什么）。需要合并原始事实的 facet
 * 必须自己实现 {@link GroupStatusFacet.merge}。
 */
export function defaultMergeFold(a: AnyFacetFold, b: AnyFacetFold): AnyFacetFold {
  // #25③：读对外导出的 `FACET_TONE_RANK`，不再另持一份私有 `TONE_ORDER`。两份表的顺序
  // 逐项相同（`{info:0,warn:1,error:2}` 与 `['info','warn','error']` 的下标一致），所以对
  // 合法色档这是**零行为变更**；收口的是「同一个事实两份实现」本身。
  //
  // ⚠️ `?? -1` **不是防御性冗余，是负载性的，别顺手删**。`facetRejection` 只校验
  // protocol / id / 三个方法，**不校验 `fold()` 返回的 `tone`** —— 那是跨插件边界，坏
  // provider 交回一个非法档位是真能到达这里的。旧的 `TONE_ORDER.indexOf(非法值)` 得到
  // `-1`，于是另一侧的合法档位必胜（`2 > -1`）；而 `FACET_TONE_RANK[非法值]` 得到
  // `undefined`，任何比较都是 `false`，非法档位就会被**传播出去**。少了这个 `?? -1`，
  // 本次重构会在坏输入下静默改变结果。
  const toneA = FACET_TONE_RANK[a.tone] ?? -1
  const toneB = FACET_TONE_RANK[b.tone] ?? -1
  return {
    count: a.count + b.count,
    tone: toneB > toneA ? b.tone : a.tone,
    pulse: a.pulse || b.pulse,
  }
}

/**
 * 登记表面：一个可订阅的 facet 列表。
 *
 * 用闭包工厂里的**模块级单例**，于是 provider 与本插件拿到的是同一张表：模块表行
 * 只在首次 `require` 时 materialize，之后所有调用方共享同一实例。
 */
export interface FacetRegistry {
  /**
   * 登记一个 facet。
   *
   * 同 id 已存在时按**来源**决胜（{@link FACET_ORIGIN_RANK}）：更高来源保持原位，
   * 同来源或更高者覆盖。返回失败而不静默丢弃，调用方能在 console 里查到原因。
   */
  register(facet: AnyFacet): FacetRegistration
  /**
   * 摘掉一个登记项。
   *
   * 给了 `facet` 时只摘"**当前登记的还是它**"的那一份：同 id 已被后来的实现替换后，
   * 旧 provider 的 dispose 不该把新登记摘掉。
   * @returns 是否真的摘掉了。
   */
  remove(id: string, facet?: AnyFacet): boolean
  /** 当前登记项，按 `order` 再按注册先后排序。 */
  list(): readonly RegisteredFacet[]
  /** 订阅登记面变化（注册/注销时触发）。 */
  subscribe(listener: () => void): () => void
}

/** 创建一张登记表面（测试用；生产走模块级单例 {@link registry}）。 */
export function createFacetRegistry(): FacetRegistry {
  const entries = new Map<string, RegisteredFacet>()
  const listeners = new Set<() => void>()
  let sequence = 0
  let sorted: readonly RegisteredFacet[] = []

  const resort = (): void => {
    sorted = [...entries.values()].sort((x, y) => {
      // 排序键 = (有没有声明 order, order, 注册序号)。
      // 没声明 order 的来源一律排在**所有声明过的之后**，彼此按注册先后：陌生新来者
      // 不该插到既有状态前面抢视觉位置，而两两之间又没有可比的新排序键。
      const declaredX = x.facet.order !== undefined
      const declaredY = y.facet.order !== undefined
      if (declaredX !== declaredY) return declaredX ? -1 : 1
      if (declaredX && declaredY) return (x.facet.order as number) - (y.facet.order as number)
      return x.sequence - y.sequence
    })
  }

  let notifying = false
  let pending = false

  /**
   * 通知订阅者，并把**重入合并成一轮补跑**。
   *
   * 订阅者在自己的回调里登记/注销 facet 是完全合法的（消费方常在收到变更后立即
   * 补登记一个派生来源）。直接递归会有两个问题：嵌套深度由订阅者数量决定（两个互相
   * 触发的订阅者就是无界递归），而且中间那轮通知看到的登记面是**改到一半**的。
   * 所以内层调用只置脏标志，外层跑完一轮后再补一轮，直到没有新的改动 —— 每个订阅者
   * 都看得到最终状态，递归深度恒为 1。
   */
  const notify = (): void => {
    if (notifying) {
      pending = true
      return
    }
    notifying = true
    try {
      do {
        pending = false
        // 复制一份再遍历：订阅者可能在回调里退订自己。
        for (const listener of [...listeners]) {
          try {
            listener()
          } catch {
            /* 单个订阅者异常不影响其余订阅者 */
          }
        }
      } while (pending)
    } finally {
      notifying = false
      pending = false
    }
  }

  return {
    register: (facet) => {
      const reason = facetRejection(facet)
      const id = typeof facet?.id === 'string' ? facet.id : ''
      if (reason !== undefined) return { ok: false, id, reason }
      const existing = entries.get(id)
      const nextRank = FACET_ORIGIN_RANK[facetOrigin(facet)]
      if (existing !== undefined && FACET_ORIGIN_RANK[facetOrigin(existing.facet)] > nextRank) {
        // 同 id 上站着更高来源的登记（状态所有者已经自己接入），低的一边让位。
        return { ok: false, id, reason: 'superseded' }
      }
      sequence += 1
      // 同来源重复登记直接覆盖：provider 热替换实现不必先注销再登记。
      entries.set(id, { facet, sequence })
      resort()
      notify()
      return { ok: true, id }
    },
    remove: (id, facet) => {
      const current = entries.get(id)
      if (current === undefined) return false
      if (facet !== undefined && current.facet !== facet) return false
      entries.delete(id)
      resort()
      notify()
      return true
    },
    list: () => sorted,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

/**
 * 挂在 `globalThis` 上的登记表面的键名。
 *
 * 它同时是**现场诊断入口**：宿主里可以直接
 * `globalThis.__dshGroupStatusFacetRegistry__.list().map(e => e.facet.id)` 读出"此刻到底
 * 有哪些状态源登记上了"——「我注册了为什么没显示」不该只能靠猜（协议文档点名的那类
 * 不可诊断失败）。
 */
const SHARED_REGISTRY_KEY = '__dshGroupStatusFacetRegistry__'

/** 只声明这一把键的宿主对象面（`globalThis` 上别人家的键与本模块无关）。 */
interface SharedRegistryHost {
  [SHARED_REGISTRY_KEY]?: FacetRegistry
}

/**
 * 取（并首次创建）**进程级**共享的登记表面。
 *
 * ## 为什么不能是模块级
 *
 * 提供方把 facet 注册进来是一次性的：它在自己的 `apply` 里 `require` 本插件的 client
 * 入口、登记完就把注销函数挂在 effect 上。而宿主的热替换（HMR、`reload(id, rev)`）
 * **只换代被替换的那个模块**——`dsh-client-modules` 的 `invalidate()` 只删自己那一行的
 * factory 与 loadCache，不级联到"谁 require 过它"（依赖方不会重跑 apply）。
 *
 * 于是模块级单例在这里必然失效：本插件被换成新实例 → 新实例建一张**空表** → 提供方
 * 那份注册留在被丢弃的旧表上 → 徽标从此少一家，且**只有刷新页面才好**。开发环境天天
 * 重建 `lib/`，这条几乎必然发生。
 *
 * 挂到 `globalThis` 上之后，换代只是"再拿一次同一张表"：注册跨换代存活，`facetStore()`
 * 在新实例里 `rewire()` 时照样订阅到那些来源。提供方被换代时按同 id 覆盖登记（见
 * {@link FacetRegistry.register} 的来源决胜），不会重复计数。
 *
 * @returns 全进程唯一的登记表面。
 */
export function sharedFacetRegistry(): FacetRegistry {
  const host = globalThis as typeof globalThis & SharedRegistryHost
  const existing = host[SHARED_REGISTRY_KEY]
  if (existing !== undefined) return existing
  const created = createFacetRegistry()
  host[SHARED_REGISTRY_KEY] = created
  return created
}

/**
 * 生产用的单例登记表面。
 *
 * 与 {@link createFacetRegistry} 分开，是为了让测试能对着一张干净的表断言协议行为，
 * 而不会被别的用例或别的插件登记的 facet 污染。
 *
 * ⚠️ 它只是 {@link sharedFacetRegistry} 在**本模块首次加载时**取到的那份引用；跨模块实例
 * 存活的是 globalThis 上那一张，所以运行期一律经 {@link sharedFacetRegistry} 现取。
 */
export const registry: FacetRegistry = sharedFacetRegistry()

/**
 * 本插件 client 入口对外的登记函数（provider 侧唯一需要认识的符号）。
 *
 * @param facet - 待登记的 facet。
 * @returns 注销函数；**注册失败时返回一个空操作**，同时把原因写进 console——
 *   返回值形状保持稳定，provider 的 dispose 路径不必区分成败。
 */
export function registerGroupStatusFacet(facet: AnyFacet): Unregister {
  // 现取共享表，而不是用模块加载时那份引用：`globalThis` 上的表被换掉（测试清场、
  // 或未来支持热切换实现）之后，新注册必须落到**当前活着**的那张表上。
  const target = sharedFacetRegistry()
  const result = target.register(facet)
  if (!result.ok) {
    // 过渡期适配器被状态所有者顶掉是**预期结果**，不是错误：报一条 warn 会让人以为
    // 徽标坏了。除此之外的每一次失败都必须可见，否则"注册了却没显示"无从诊断。
    if (!(result.reason === 'superseded' && facetOrigin(facet) === 'legacy')) reportRejection(result)
    return () => undefined
  }
  // 只摘"还是自己"的那一份：同 id 已被后来的实现替换时，旧 dispose 不该动新登记。
  return () => {
    target.remove(result.id, facet)
  }
}

/**
 * 把注册失败写成一条可诊断的日志。
 *
 * 刻意不抛错：状态显示是增强功能，一个插件协议填错不该把宿主界面渲染打断；
 * 但也不静默——"注册了却没显示"必须能查出原因。
 */
function reportRejection(rejection: { id: string; reason: FacetRejection }): void {
  const detail = rejection.reason === 'protocol-mismatch'
    ? `本插件只接受 protocol: ${GROUP_STATUS_FACET_PROTOCOL_VERSION}`
    : rejection.reason === 'missing-methods'
      ? 'subscribe / getSnapshot / fold 三个方法必须齐备'
      : rejection.reason === 'missing-id'
        ? "id 必须是非空字符串，建议 '<包名>.<状态名>'"
        : rejection.reason === 'superseded'
          ? '同 id 上已有更高来源的登记；两个不同插件用了同一个 id，请各自换名'
          : 'facet 必须是一个对象'
  console.warn(`dsh-group-status: 拒绝登记状态 facet "${rejection.id}"（${rejection.reason}）：${detail}`)
}
