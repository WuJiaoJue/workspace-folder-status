/**
 * Fork-owned: aggregated live-status computation for collapsed workspace groups.
 *
 * Extracted from `tree.ts` so the upstream diff surface is minimal — the
 * vendored file only needs one import line and one field assignment to wire
 * the badge aggregation in. Everything fork-specific lives here.
 *
 * ## 本模块不认识任何具体状态源
 *
 * 它只统计宿主自己的行级事实（进行中 / 待审批 / 计划待审 / 等待回答 / 已完成 /
 * 子智能体）；外部状态一律经 `./facets.ts` 的协议折成 {@link FacetFold}。
 *
 * 这不是洁癖：此前这里为定时任务与等待评审各写了一组具名字段和一套查表，于是提供方
 * 新增字段时本插件的本地类型一无所知，信息**静默丢失**（不报错、测试也不红，见
 * CHANGELOG 0.2.3 第一条）。把语义留在拥有它的那一侧，这类漂移才结构上不可能发生。
 *
 * @module
 */
import type { AnyFacet, AnyFacetFold, RegisteredFacet } from './facets.ts'
import { defaultMergeFold } from './facets.ts'
import type { GroupNode, SessionNode } from './tree.ts'

// ── Aggregated status ──

/**
 * Aggregated live-session counts for one group, computed over all members so a
 * folded folder row can hint at hidden activity.
 */
export interface GroupLiveStatus {
  /** Members currently running. */
  running: number
  /** Members awaiting tool approval. */
  approval: number
  /** Members awaiting plan review. */
  planReview: number
  /** Members awaiting a question answer. */
  question: number
  /** Members finished and not yet opened (the green "done" reminder). */
  done: number
  /** Running direct children across members. */
  subagents: number
  /**
   * 外部状态源的折果，按 facet id 索引，只含**有贡献**的来源（`count > 0`）。
   *
   * 这里刻意没有 `scheduled*` / `waitingReview*` 这类具名字段：徽标一旦为某个来源开
   * 一个字段，就等于把别人家的语义焊进自己的类型，新增来源就得改本插件。
   * `FacetFold.data` 的形状只有该来源自己读。
   */
  facets: ReadonlyMap<string, FacetEntry>
}

/**
 * 一个来源在**这一组**上的折果，连同它自己的 facet。
 *
 * 带上 facet 是为了让渲染（文案、图标、脉冲）与多层合并（`facet.merge`）都不必再回
 * 登记面查表——也就不需要任何模块级状态。
 */
export interface FacetEntry {
  facet: AnyFacet
  fold: AnyFacetFold
}

/** 空折果表：让哨兵的引用跨渲染稳定。 */
const EMPTY_FACETS: ReadonlyMap<string, FacetEntry> = new Map()

/**
 * Zero-valued sentinel for {@link GroupLiveStatus}.
 *
 * Used when a group has nothing to report. Kept as a frozen constant so the
 * reference is stable across renders — `Object.is` comparisons in React selectors
 * never trigger spurious re-renders on it.
 */
export const EMPTY_LIVE_STATUS: GroupLiveStatus = Object.freeze({
  running: 0, approval: 0, planReview: 0, question: 0, done: 0, subagents: 0,
  facets: EMPTY_FACETS,
}) as GroupLiveStatus

/**
 * 一份**没有任何贡献**的折果：六个计数全 0 且没有外部来源。
 *
 * 它在合并里是加法单位元，所以「加它」不该产生新对象——见 {@link mergeLiveStatus}。
 */
function isIdleStatus(status: GroupLiveStatus): boolean {
  return status.running === 0 && status.approval === 0 && status.planReview === 0
    && status.question === 0 && status.done === 0 && status.subagents === 0
    && status.facets.size === 0
}

/**
 * 合并两份分组折果：本插件自己的计数相加，外部状态来源**按 facet 各自合并**。
 *
 * 用于多层聚合：折叠的父文件夹要覆盖整棵子树，而子树里每一层都已各自折过一遍。
 * `FacetFold.data` 怎么合归该 facet 自己决定，本模块从不解释。
 *
 * 加法单位元走**引用原样返回**：值不变时换一个新对象，会让"同一棵空闲子树"在两轮
 * 计算之间有不同的身份。`EMPTY_LIVE_STATUS` 留在这个模块里的理由就是身份稳定（见其
 * 注释），合并这一层不该每加一次零就把那个理由作废。返回的是入参本身（不改写、不
 * 拷贝），因此与逐字段相加的结果等值。
 */
export function mergeLiveStatus(a: GroupLiveStatus, b: GroupLiveStatus): GroupLiveStatus {
  if (isIdleStatus(b)) return a
  if (isIdleStatus(a)) return b
  return {
    running: a.running + b.running,
    approval: a.approval + b.approval,
    planReview: a.planReview + b.planReview,
    question: a.question + b.question,
    done: a.done + b.done,
    subagents: a.subagents + b.subagents,
    facets: mergeFacets(a.facets, b.facets),
  }
}

/** 按 facet id 合并两侧折果；只有一侧有的来源原样带过。 */
function mergeFacets(
  a: ReadonlyMap<string, FacetEntry>,
  b: ReadonlyMap<string, FacetEntry>,
): ReadonlyMap<string, FacetEntry> {
  if (a.size === 0) return b
  if (b.size === 0) return a
  const merged = new Map<string, FacetEntry>(a)
  for (const [id, entry] of b) {
    const own = merged.get(id)
    // 合并规则由该来源自己声明；缺省只加数量、取更紧急的色档、脉冲取或。
    // 合并后仍沿用先登记那一份的 facet 引用：两侧本就是同一个来源。
    merged.set(id, own === undefined
      ? entry
      : { facet: own.facet, fold: own.facet.merge?.(own.fold, entry.fold) ?? defaultMergeFold(own.fold, entry.fold) })
  }
  return merged
}

// ── Main computation ──

/**
 * Fold every member row of a group into counts so a collapsed folder can hint at
 * hidden live sessions. Mirrors the session-row status priority (pending
 * outranks running outranks completed) at the counting level; labels resolve with
 * locale at render time.
 *
 * @param nodes - member rows of the group.
 * @param sessionIds - the same members' Session ids (facets address their own data by id).
 * @param facets - the registered status sources to fold over this group.
 * @param now - one clock reading for the whole pass, so sibling facets cannot disagree
 *   about which deadlines are still ahead.
 */
export function summarizeGroupStatus(
  nodes: readonly SessionNode[],
  sessionIds: readonly string[],
  facets: readonly RegisteredFacet[] = [],
  now: number = Date.now(),
): GroupLiveStatus {
  let running = 0
  let approval = 0
  let planReview = 0
  let question = 0
  let done = 0
  let subagents = 0
  // #25②：这一段曾与 `rows/Rows.tsx` 的 `sessionStatuses()` 各写一份优先级，两处结果不同
  // （pending 会话漏算子智能体；未运行但已完成 + 有运行中子智能体时两处判断相反）。计数
  // 判据仍在本模块（徽标只需要五个数字），但**语义以行内为准**：行内 pending 会同时给出
  // subagents，未运行且有 subagents 时不承认 completed。下面的分支刻意照抄那两条规则，
  // 不是另立一套「徽标自己的优先级」。
  for (const n of nodes) {
    if (n.blank || n.archived) continue
    const hasSubagents = n.runningSubagentCount > 0
    // 行内：pending 与 subagents 可并存（Rows.tsx `[pending, subagents]`），故不 `continue`。
    if (n.pendingInteraction === 'approval') { approval += 1; subagents += n.runningSubagentCount; continue }
    if (n.pendingInteraction === 'plan-review') { planReview += 1; subagents += n.runningSubagentCount; continue }
    if (n.pendingInteraction === 'question') { question += 1; subagents += n.runningSubagentCount; continue }
    if (n.running) { running += 1; subagents += n.runningSubagentCount; continue }
    // 行内：subagents 优先于 completed（`if (subagents !== undefined) return [subagents]`）。
    if (hasSubagents) { subagents += n.runningSubagentCount; continue }
    if (n.completed) done += 1
  }

  // 外部来源逐个折。一个来源坏了不该带塌整只徽标：快照读失败按「此刻没有数据」处理，
  // 折叠抛错则跳过该来源——两者都不往渲染管线里扩散。
  const folded = new Map<string, FacetEntry>()
  for (const { facet } of facets) {
    let snapshot: unknown
    try {
      snapshot = facet.getSnapshot()
    } catch {
      snapshot = undefined
    }
    try {
      const result = facet.fold(snapshot, sessionIds, now)
      // `count <= 0` 的来源不进表：数字、图标、文案、显隐判定都当它不存在。
      if (result !== undefined && result.count > 0) folded.set(facet.id, { facet, fold: result })
    } catch {
      /* 同上：这个来源此刻不参与徽标 */
    }
  }

  // 空闲组交回**冻结哨兵**而不是等值的新对象：这是 `EMPTY_LIVE_STATUS` 存在的理由
  // （引用跨渲染稳定，见其注释），而一次重算若为每个空闲组各造一份零值对象，哨兵
  // 就白留了。聚合时两侧都是哨兵，`mergeLiveStatus` 会原样返回同一引用。
  if (running === 0 && approval === 0 && planReview === 0 && question === 0
    && done === 0 && subagents === 0 && folded.size === 0) return EMPTY_LIVE_STATUS
  return { running, approval, planReview, question, done, subagents, facets: folded }
}

/**
 * Measure each group's own members, as the input to {@link aggregateGroupStatuses}.
 *
 * Every group is measured, expanded ones included. A folder row shows no badge while
 * it is expanded, but its sessions still need attention and a collapsed ancestor must
 * keep counting them — so expansion is a rendering fact, never an input to the
 * aggregation. Short-circuiting expanded groups to `EMPTY_LIVE_STATUS` (the shape this
 * had before the tree-wide aggregator existed, harmless while nothing aggregated) makes
 * every collapsed parent undercount by the size of its expanded descendants.
 *
 * @param groups - derived groups, each with its member rows already populated.
 * @param facets - registered sources, already filtered by the visibility settings.
 * @param now - one clock reading shared by every group in the pass.
 */
export function directStatusesForGroups(
  groups: readonly { key: string; sessions: readonly SessionNode[] }[],
  facets: readonly RegisteredFacet[] = [],
  now: number = Date.now(),
): Map<string, GroupLiveStatus> {
  const map = new Map<string, GroupLiveStatus>()
  for (const group of groups) {
    map.set(group.key, summarizeGroupStatus(
      group.sessions, group.sessions.map(s => s.id), facets, now,
    ))
  }
  return map
}

/**
 * Fold every group's DIRECT status up the workspace tree, so a collapsed folder
 * counts every descendant session. A group's own row shows no badge while it is
 * expanded, but its sessions still need attention and its collapsed ancestor must
 * keep counting them — so the walk never depends on a group's expanded state.
 *
 * @param direct - each group's own-member status, keyed by group key.
 * @param childrenByParent - the rendered tree: parent key (`undefined` = roots) → children.
 * @returns aggregated status per group key: own members plus the whole subtree.
 */
export function aggregateGroupStatuses(
  direct: ReadonlyMap<string, GroupLiveStatus>,
  childrenByParent: ReadonlyMap<string | undefined, readonly { key: string }[]>,
): Map<string, GroupLiveStatus> {
  const aggregated = new Map<string, GroupLiveStatus>()
  // Parentage comes from path-prefix matching, so a self- or mutual-parent edge is
  // representable; without this guard the fold would recurse forever and hang the sidebar.
  const visiting = new Set<string>()
  const fold = (key: string): GroupLiveStatus => {
    const cached = aggregated.get(key)
    if (cached !== undefined) return cached
    if (visiting.has(key)) return direct.get(key) ?? EMPTY_LIVE_STATUS
    visiting.add(key)
    let total = direct.get(key) ?? EMPTY_LIVE_STATUS
    for (const child of childrenByParent.get(key) ?? []) {
      total = mergeLiveStatus(total, fold(child.key))
    }
    visiting.delete(key)
    aggregated.set(key, total)
    return total
  }
  // Every listed child is folded, not just the roots: an unreachable group would
  // otherwise be missing from the map and lose its badge.
  for (const children of childrenByParent.values()) {
    for (const child of children) fold(child.key)
  }
  return aggregated
}

/**
 * A group row whose badge input is resolved: its own members plus its whole subtree.
 *
 * `GroupNode.liveStatus` is optional only because upstream never fills it — this
 * package's aggregator is the sole producer. Typing a rendered row as
 * `StatusedGroupNode` is what turns "a row that skipped the aggregator" into a compile
 * error instead of a folder that silently lost its badge, which is how the PR #10
 * regression reached main.
 */
export interface StatusedGroupNode extends GroupNode {
  liveStatus: GroupLiveStatus
}

/**
 * Attach each group's subtree-wide status, in derivation order. This is the producer
 * the sidebar renders from.
 *
 * Expanded groups carry their status too: their own row draws no badge (a decision
 * inside `groupLiveBadge`), but a collapsed ancestor still has to count them, so
 * expansion never suppresses the measurement.
 *
 * @param groups - derived rows, in the order they render.
 * @param direct - each group's own-member status, from {@link directStatusesForGroups}.
 * @param childrenByParent - the rendered tree: parent key (`undefined` = roots) → children.
 */
export function withAggregatedStatus(
  groups: readonly GroupNode[],
  direct: ReadonlyMap<string, GroupLiveStatus>,
  childrenByParent: ReadonlyMap<string | undefined, readonly GroupNode[]>,
): StatusedGroupNode[] {
  const aggregated = aggregateGroupStatuses(direct, childrenByParent)
  // A group missing from the fold has neither measured members nor listed children,
  // so it is idle rather than unknown.
  return groups.map(group => ({ ...group, liveStatus: aggregated.get(group.key) ?? EMPTY_LIVE_STATUS }))
}
