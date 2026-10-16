/**
 * 过渡期适配器：dsh-gitea-dispatch 的「等待评审」→ facet。
 *
 * ⚠️ **本目录整体是临时的**。dsh-gitea-dispatch 自己按 `../facets.ts` 的协议注册之后
 * （对应它的 issue「把摘要 API 升级为 facet 注册」），这个文件与 `schedule.ts`、
 * `facet-icons.tsx` 一起删除，本插件不再认识任何具体状态源。
 *
 * 保留在 `legacy/` 而不是混进核心，是为了让"删除它"成为一次可执行的收尾，而不是一句
 * 口头承诺：核心模块（`group-status.ts` / `badge-labels.ts` / `rows/GroupBadge.tsx`）
 * 里没有任何 `waitingReview` 字样可寻。
 *
 * ## 为什么这里既读快照又自己折
 *
 * 提供方（issue #16）导出 `summarizeWaitingGroup()`。能用到就用它：id 口径、
 * `overdue > waiting` 排序、截止时刻算法都是它的所有物，委托才不会再出现"提供方加了
 * 字段而徽标不知道"的静默丢数据。它不导出（旧版本）时才用本文件的等价实现。
 *
 * @module dsh-group-status/client/legacy/waiting-review
 */
import { entryFor } from '../cross-plugin-summary.ts'
import type { FacetFold, FacetRenderContext, FacetTone, GroupStatusFacet } from '../facets.ts'
import { GROUP_STATUS_FACET_PROTOCOL_VERSION } from '../facets.ts'

/** facet id：与 dsh-gitea-dispatch 自己注册时应当使用的 id 保持一致。 */
export const WAITING_REVIEW_FACET_ID = 'dsh-gitea-dispatch.waiting-review'

// ── 提供方发布的形状（结构声明，不产生编译期依赖）──

/**
 * 一条等待评审事实，来自 dsh-gitea-dispatch 的 `useWaitingSummary()`
 * （issue: dsh-gitea-dispatch#16）。
 *
 * 可选字段是提供方契约的一部分：正是它们让徽标能说「在等哪个 PR」「还剩多久」。
 * 本类型此前只声明 `{ prNumber, state }`，于是提供方已经取回的信息被静默丢掉。
 */
export interface WaitingReviewSummaryEntry {
  readonly prNumber: number
  readonly state: 'waiting' | 'overdue'
  /** 等待起点（宿主 state 里是 epoch ms，过 wire 可能是 ISO 字符串）。 */
  readonly startedAt?: number | string
  /** CI 声明的等待上限（秒）；缺省 = 时长未知。 */
  readonly waitMaxSec?: number
  /** CI 声明的绝对截止（epoch ms）；优先于 `startedAt + waitMaxSec`。 */
  readonly deadline?: number
}

/** 会话 id → 该会话的等待事实（没有条目 = 没在等）。 */
export type WaitingReviewSummaryMap = ReadonlyMap<string, WaitingReviewSummaryEntry>

/** 提供方 `summarizeWaitingGroup()` 的折果形状。 */
export interface WaitingReviewFold {
  /** 组内**在等**的会话数。 */
  sessions: number
  /** 组内在等的 PR 号（按传入会话顺序）。 */
  prNumbers: readonly number[]
  /** 组内最高优先级状态：overdue > waiting。 */
  state: 'waiting' | 'overdue' | undefined
  /** 组内**尚未到点**的最早截止（epoch ms）；无则缺省。 */
  nextDeadline?: number
}

/** 提供方的分组聚合函数面。 */
export type WaitingReviewSummarizer = (
  summary: WaitingReviewSummaryMap,
  sessionIds: readonly string[],
  now: number,
) => WaitingReviewFold

/** 等待折果携带的数据：徽标从不解释它，只有本 facet 读。 */
export interface WaitingReviewData {
  readonly prNumbers: readonly number[]
  readonly state: 'waiting' | 'overdue' | undefined
  readonly nextDeadline?: number
}

/**
 * 一条等待的绝对截止（epoch ms）；`undefined` = 时长未知。
 *
 * 刻意与提供方的 `deadlineOf` 同口径（绝对 deadline 优先，才退 `startedAt + waitMaxSec`）：
 * CI 的等待从"进入循环"起算，而广播在此之前已发出，只按时长算会让徽标的倒计时晚于
 * 真实截止（其 Issues #2577）。`startedAt` 的两种形态同理都要认。
 */
export function waitingDeadlineOf(entry: WaitingReviewSummaryEntry): number | undefined {
  if (typeof entry.deadline === 'number' && Number.isFinite(entry.deadline)) return entry.deadline
  const started = typeof entry.startedAt === 'number'
    ? entry.startedAt
    : typeof entry.startedAt === 'string' && entry.startedAt !== ''
      ? Date.parse(entry.startedAt)
      : Number.NaN
  if (
    Number.isFinite(started)
    && typeof entry.waitMaxSec === 'number'
    && Number.isFinite(entry.waitMaxSec)
    && entry.waitMaxSec > 0
  ) {
    return started + entry.waitMaxSec * 1000
  }
  return undefined
}

/**
 * 提供方聚合面缺席时的等价折叠。
 *
 * 与提供方的 `summarizeWaitingGroup()` 同一套判据：四形态 id 兜底（复用
 * `cross-plugin-summary.ts` 的 `entryFor`，规则与它的 `waitingEntryFor` 相同）、
 * `overdue > waiting` 排序、只把**未到期**的截止算作 `nextDeadline`。
 */
export function summarizeWaitingGroupLocally(
  summary: WaitingReviewSummaryMap,
  sessionIds: readonly string[],
  now: number,
): WaitingReviewFold {
  const prNumbers: number[] = []
  let state: 'waiting' | 'overdue' | undefined
  let nextDeadline: number | undefined
  for (const sessionId of sessionIds) {
    const entry = entryFor(summary, sessionId)
    if (entry === undefined) continue
    prNumbers.push(entry.prNumber)
    if (entry.state === 'overdue') state = 'overdue'
    else if (state === undefined) state = 'waiting'
    const deadline = waitingDeadlineOf(entry)
    // 已到点的条目由 `state: 'overdue'` 表达；把它算进倒计时会折出一个负数。
    if (deadline !== undefined && deadline > now && (nextDeadline === undefined || deadline < nextDeadline)) {
      nextDeadline = deadline
    }
  }
  const fold: WaitingReviewFold = { sessions: prNumbers.length, prNumbers, state }
  // 用"缺键"而不是"键=undefined"对齐提供方：两条路径对下游必须不可区分。
  if (nextDeadline !== undefined) fold.nextDeadline = nextDeadline
  return fold
}

/** 折果 `data` 的读取（本文件内部用）。 */
function dataOf(fold: FacetFold<WaitingReviewData>): WaitingReviewData {
  return fold.data ?? { prNumbers: [], state: undefined }
}

/** 把提供方的折果装进 facet 形状（数量 / 色档 / 脉冲）。 */
function toFacetFold(source: WaitingReviewFold): FacetFold<WaitingReviewData> {
  const tone: FacetTone = source.state === 'overdue' ? 'error' : 'warn'
  // 脉冲刻意不给等待评审的超时：提供方把 `overdue` 画成**静止**（其
  // `lib/waiting-glyph.js`：「超时后停动画：静止即不再期待」），且它只代表 CI
  // 窗口到期、不代表评审失败。同一条等待在行内静止、在父级闪动是两套说法。
  // `nextDeadline` 缺键而不是 =undefined：与提供方的折果形状一致，也让两条折叠路径
  // （委托 / 本地）对下游不可区分。
  const data: WaitingReviewData = source.nextDeadline === undefined
    ? { prNumbers: source.prNumbers, state: source.state }
    : { prNumbers: source.prNumbers, state: source.state, nextDeadline: source.nextDeadline }
  return { count: source.sessions, tone, pulse: false, data }
}

/**
 * 同 facet 跨层合并：PR 号取并集去重升序、色档取更紧急的一档、
 * 倒计时取两侧更早的那个未到期截止。
 */
export function mergeWaitingReviewFold(a: FacetFold<WaitingReviewData>, b: FacetFold<WaitingReviewData>): FacetFold<WaitingReviewData> {
  const left = dataOf(a)
  const right = dataOf(b)
  const prNumbers = [...new Set([...left.prNumbers, ...right.prNumbers])].sort((x, y) => x - y)
  const state = left.state === 'overdue' || right.state === 'overdue'
    ? 'overdue'
    : left.state ?? right.state
  const deadlines = [left.nextDeadline, right.nextDeadline].filter((v): v is number => v !== undefined)
  const nextDeadline = deadlines.length === 0 ? undefined : Math.min(...deadlines)
  const data: WaitingReviewData = nextDeadline === undefined
    ? { prNumbers, state }
    : { prNumbers, state, nextDeadline }
  return {
    count: a.count + b.count,
    tone: state === 'overdue' ? 'error' : 'warn',
    pulse: a.pulse || b.pulse,
    data,
  }
}

/** `#15, #2783(+2)`：去重升序、封顶三个。 */
export function prNumberList(prNumbers: readonly number[] | undefined): string {
  if (prNumbers === undefined || prNumbers.length === 0) return ''
  const distinct = [...new Set(prNumbers)].sort((a, b) => a - b)
  const shown = distinct.slice(0, 3).map(pr => `#${pr}`)
  if (distinct.length > shown.length) shown.push(`+${distinct.length - shown.length}`)
  return shown.join(', ')
}

/**
 * 等待评审那一句文案：状态 + 剩余时长（分钟粒度）+ PR 号。
 *
 * 措辞与提供方自己的行内呈现同档（`等待评审 3:28` / `评审等待已超时` / `等待评审结果`），
 * 但只到分钟：徽标只在提供方 store 通知时重渲染，秒级读数会停在旧值上撒谎。
 */
export function waitingReviewLabel(fold: FacetFold<WaitingReviewData>, context: FacetRenderContext): string {
  const t = context.t
  const data = dataOf(fold)
  const phrase = (() => {
    if (data.state === 'overdue') return t('status.waitingReviewOverdue')
    const deadline = data.nextDeadline
    if (deadline === undefined) return t('status.waitingReview')
    const left = Math.max(0, deadline - context.now)
    if (left < 60_000) return t('status.waitingReviewImminent')
    if (left < 3_600_000) return t('status.waitingReviewLeft', { time: t('time.minutes', { n: Math.floor(left / 60_000) }) })
    return t('status.waitingReviewLeft', { time: t('time.hours', { n: Math.floor(left / 3_600_000) }) })
  })()
  const prs = prNumberList(data.prNumbers)
  return prs === '' ? `${fold.count} ${phrase}` : `${fold.count} ${phrase} · ${prs}`
}

/**
 * 构造本插件内置的等待评审 facet。
 *
 * @param input - 提供方的摘要读取面；`summarize` 缺席时退回本地等价折叠。
 * @param input.subscribe - 订阅快照变化（提供方 store 的订阅面）。
 * @param input.getSnapshot - 读当前摘要 Map。
 * @param input.summarize - 提供方的分组聚合（有则委托）。
 */
export function createWaitingReviewFacet(input: {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => WaitingReviewSummaryMap | undefined
  summarize?: WaitingReviewSummarizer
}): GroupStatusFacet<WaitingReviewSummaryMap | undefined, WaitingReviewData> {
  const summarize = input.summarize ?? summarizeWaitingGroupLocally
  return {
    protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION,
    id: WAITING_REVIEW_FACET_ID,
    origin: 'legacy',
    settingKey: 'showWaitingReviewInBadge',
    order: 20,
    subscribe: input.subscribe,
    getSnapshot: input.getSnapshot,
    fold: (snapshot, sessionIds, now) => toFacetFold(
      snapshot === undefined || sessionIds.length === 0
        ? { sessions: 0, prNumbers: [], state: undefined }
        : summarize(snapshot, sessionIds, now),
    ),
    merge: mergeWaitingReviewFold,
    label: waitingReviewLabel,
  }
}
