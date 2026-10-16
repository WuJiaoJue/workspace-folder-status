/**
 * Fork-owned: aggregated live-status computation for collapsed workspace groups.
 *
 * Extracted from `tree.ts` so the upstream diff surface is minimal — the
 * vendored file only needs one import line and one field assignment to wire
 * the badge aggregation in. Everything fork-specific lives here.
 *
 * @module
 */
import { entryFor } from './cross-plugin-summary.ts'
import type { GroupNode, SessionNode } from './tree.ts'

// ── Types (structurally typed to avoid compile-time dependency on cross-plugin packages) ──

/**
 * One session's waiting-review fact, as published by dsh-gitea-dispatch's
 * `useWaitingSummary()` (issue: dsh-gitea-dispatch#16).
 *
 * The optional fields are part of that publisher's contract and are what lets the
 * badge say *which* PR and *how long is left*; the earlier version of this type
 * declared only `{ prNumber, state }`, so the badge silently threw away everything
 * else the publisher had already fetched for it.
 */
export interface WaitingReviewSummaryEntry {
  readonly prNumber: number
  readonly state: 'waiting' | 'overdue'
  /** Wait start (epoch ms from the Host state, ISO string across the wire). */
  readonly startedAt?: number | string
  /** CI-declared wait window (seconds); absent = the duration is unknown. */
  readonly waitMaxSec?: number
  /** CI-declared absolute deadline (epoch ms); preferred over `startedAt + waitMaxSec`. */
  readonly deadline?: number
}

/** Session id → that session's waiting-review fact (no entry = not waiting). */
export type WaitingReviewSummaryMap = ReadonlyMap<string, WaitingReviewSummaryEntry>

/**
 * Group-level fold of the waiting map: the shape dsh-gitea-dispatch publishes as
 * `summarizeWaitingGroup()` (issue: dsh-gitea-dispatch#16). Declared here as a
 * structural type so this plugin keeps no compile-time dependency on that package.
 */
export interface WaitingReviewFold {
  /** Members that are waiting. */
  sessions: number
  /** PR numbers waited on, in the order the member ids were passed. */
  prNumbers: readonly number[]
  /** Highest-priority state across the group: overdue > waiting. */
  state: 'waiting' | 'overdue' | undefined
  /** Earliest **still-future** deadline in the group; absent = nothing to count down to. */
  nextDeadline?: number
}

/**
 * The publisher's own group fold, when its client half exports one.
 *
 * Used in preference to {@link summarizeWaitingGroupLocally}: the publisher owns the
 * id conventions, the state ranking and the deadline arithmetic, so delegating keeps
 * the badge from drifting the moment any of those change. The local fold is the
 * fallback for an older publisher that exports the map but not the aggregator.
 */
export type WaitingReviewSummarizer = (
  summary: WaitingReviewSummaryMap,
  sessionIds: readonly string[],
  now: number,
) => WaitingReviewFold

/**
 * Absolute deadline of one waiting entry, in epoch ms; `undefined` = unknown duration.
 *
 * Mirrors the publisher's `deadlineOf` on purpose (absolute CI deadline first, only
 * then `startedAt + waitMaxSec`): the CI's own wait starts *before* the broadcast
 * reaches us, so a duration-only fallback would run the badge's countdown long past
 * the real deadline. Both `startedAt` shapes are accepted for the same reason.
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
 * Local stand-in for the publisher's group fold; see {@link WaitingReviewSummarizer}.
 *
 * Same lookup tolerance (all four id spellings, through `cross-plugin-summary`'s
 * `entryFor`, which is the publisher's `waitingEntryFor` rule), same ranking
 * (overdue outranks waiting), same "only future deadlines" rule for `nextDeadline`.
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
    // Only a *future* deadline is something to count down to; a passed one is already
    // expressed by `state: 'overdue'`, and counting it would render a negative wait.
    if (deadline !== undefined && deadline > now && (nextDeadline === undefined || deadline < nextDeadline)) {
      nextDeadline = deadline
    }
  }
  const fold: WaitingReviewFold = { sessions: prNumbers.length, prNumbers, state }
  // `nextDeadline` stays absent rather than set to undefined: the publisher's own fold
  // omits the key when there is nothing to count down to, and matching that shape keeps
  // the delegated and local paths indistinguishable to everything downstream.
  if (nextDeadline !== undefined) fold.nextDeadline = nextDeadline
  return fold
}

/**
 * One session's schedule fact, as published by dsh-later's `useScheduleSummary()`.
 */
export interface ScheduleSummaryEntry {
  readonly count: number
  readonly pausedCount: number
  readonly nextAt?: number
  readonly state: 'scheduled' | 'urgent' | 'overdue'
}

/** Session id → that session's schedule fact (no entry = no scheduled tasks). */
export type ScheduleSummaryMap = ReadonlyMap<string, ScheduleSummaryEntry>

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
  /** Members with scheduled tasks (from dsh-later). */
  scheduledSessions: number
  /** Total scheduled tasks across members (including paused). */
  scheduledCount: number
  /** Highest-priority schedule state: overdue > urgent > scheduled. */
  scheduleState: 'scheduled' | 'urgent' | 'overdue' | undefined
  /** Members waiting for CI review of their PR (from dsh-gitea-dispatch). */
  waitingReviewCount: number
  /** Highest-priority waiting state across members: overdue > waiting. */
  waitingReviewState: 'waiting' | 'overdue' | undefined
  /**
   * PR numbers the group is waiting on, one per waiting member (the publisher lists a PR
   * **per member**, so two members waiting on the same PR arrive twice, which is correct
   * here, and `badge-labels.ts` collapses them where the label reads). Folding folders
   * unions and sorts. Without this field the badge could say *that* a member waits but
   * never *what* it waits for.
   */
  waitingReviewPrNumbers: readonly number[]
  /**
   * Earliest still-future deadline across the group's waiting members (epoch ms).
   * Absent when every wait has an unknown duration or has already lapsed, which is
   * exactly when the badge must not render a countdown.
   */
  waitingReviewNextDeadline: number | undefined
}

/** Frozen empty PR list: keeps the sentinel's reference stable across renders. */
const EMPTY_PR_NUMBERS: readonly number[] = Object.freeze([])

/**
 * Zero-valued sentinel for {@link GroupLiveStatus}.
 *
 * Used when a group is expanded (badge is hidden, so aggregation is wasted
 * work) or when no cross-plugin data is available. Kept as a frozen constant
 * so the reference is stable across renders — `Object.is` comparisons in
 * React selectors never trigger spurious re-renders on it.
 */
export const EMPTY_LIVE_STATUS: GroupLiveStatus = Object.freeze({
  running: 0, approval: 0, planReview: 0, question: 0, done: 0, subagents: 0,
  scheduledSessions: 0, scheduledCount: 0, scheduleState: undefined,
  waitingReviewCount: 0, waitingReviewState: undefined,
  waitingReviewPrNumbers: EMPTY_PR_NUMBERS, waitingReviewNextDeadline: undefined,
}) as GroupLiveStatus

/**
 * Merge two {@link GroupLiveStatus} objects by summing counters and taking the
 * highest-priority state (overdue > urgent > scheduled for schedule; overdue > waiting
 * for waiting-review).
 *
 * Used for multi-level aggregation: when a parent group is collapsed, its badge
 * must reflect all descendant sessions, not just direct members.
 */
export function mergeLiveStatus(a: GroupLiveStatus, b: GroupLiveStatus): GroupLiveStatus {
  // Schedule state: overdue (3) > urgent (2) > scheduled (1) > undefined (0)
  const priorityOf = (s: 'scheduled' | 'urgent' | 'overdue' | undefined): number =>
    s === 'overdue' ? 3 : s === 'urgent' ? 2 : s === 'scheduled' ? 1 : 0
  const schedulePriorityA = priorityOf(a.scheduleState)
  const schedulePriorityB = priorityOf(b.scheduleState)
  const scheduleState = schedulePriorityA >= schedulePriorityB ? a.scheduleState : b.scheduleState

  // Waiting-review state: overdue > waiting > undefined
  const waitingPriorityA = a.waitingReviewState === 'overdue' ? 2 : a.waitingReviewState === 'waiting' ? 1 : 0
  const waitingPriorityB = b.waitingReviewState === 'overdue' ? 2 : b.waitingReviewState === 'waiting' ? 1 : 0
  const waitingReviewState = waitingPriorityA >= waitingPriorityB ? a.waitingReviewState : b.waitingReviewState
  // PR numbers merge into one ascending, de-duplicated list (a folded parent spans
  // several folders that may wait on the same PR); the countdown keeps the earliest
  // deadline, since "how long is still being waited for" is the question a badge answers.
  const waitingReviewPrNumbers = mergePrNumbers(a.waitingReviewPrNumbers, b.waitingReviewPrNumbers)
  const waitingReviewNextDeadline = a.waitingReviewNextDeadline === undefined
    ? b.waitingReviewNextDeadline
    : b.waitingReviewNextDeadline === undefined
      ? a.waitingReviewNextDeadline
      : Math.min(a.waitingReviewNextDeadline, b.waitingReviewNextDeadline)

  return {
    running: a.running + b.running,
    approval: a.approval + b.approval,
    planReview: a.planReview + b.planReview,
    question: a.question + b.question,
    done: a.done + b.done,
    subagents: a.subagents + b.subagents,
    scheduledSessions: a.scheduledSessions + b.scheduledSessions,
    scheduledCount: a.scheduledCount + b.scheduledCount,
    scheduleState,
    waitingReviewCount: a.waitingReviewCount + b.waitingReviewCount,
    waitingReviewState,
    waitingReviewPrNumbers,
    waitingReviewNextDeadline,
  }
}

/**
 * Ascending de-duplicated union of two PR-number lists.
 *
 * Tolerates a missing list: the same "absent field reads as nothing" rule the badge
 * settings apply, so a hand-built or older `GroupLiveStatus` merges instead of throwing.
 */
function mergePrNumbers(a: readonly number[] | undefined, b: readonly number[] | undefined): readonly number[] {
  if (a === undefined || a.length === 0) return b ?? EMPTY_PR_NUMBERS
  if (b === undefined || b.length === 0) return a
  const union = new Set(a)
  for (const pr of b) union.add(pr)
  return [...union].sort((x, y) => x - y)
}

// ── Main computation ──

/**
 * Fold every member row of a group into counts so a collapsed folder can hint at
 * hidden live sessions. Mirrors the session-row status priority (pending
 * outranks running outranks completed) at the counting level; labels resolve with
 * locale at render time.
 * @param nodes - member rows of the group.
 * @param sessionIds - the same members' Session ids (schedule and waiting facts are keyed by id).
 * @param waitingReviewSummary - dsh-gitea-dispatch waiting map, when that plugin is loaded.
 * @param scheduleSummary - dsh-later schedule map, when that plugin is loaded.
 * @param now - epoch ms used by the waiting fold to decide which deadlines are still future.
 * @param waitingReviewSummarize - the publisher's own group fold, when it publishes one.
 */
export function summarizeGroupStatus(
  nodes: readonly SessionNode[],
  sessionIds: readonly string[],
  waitingReviewSummary?: WaitingReviewSummaryMap,
  scheduleSummary?: ScheduleSummaryMap,
  now: number = Date.now(),
  waitingReviewSummarize?: WaitingReviewSummarizer,
): GroupLiveStatus {
  let running = 0
  let approval = 0
  let planReview = 0
  let question = 0
  let done = 0
  let subagents = 0
  for (const n of nodes) {
    if (n.blank || n.archived) continue
    if (n.pendingInteraction === 'approval') { approval += 1; continue }
    if (n.pendingInteraction === 'plan-review') { planReview += 1; continue }
    if (n.pendingInteraction === 'question') { question += 1; continue }
    if (n.running) running += 1
    else if (n.completed) done += 1
    subagents += n.runningSubagentCount
  }

  // Aggregate schedule summary from dsh-later
  let scheduledSessions = 0
  let scheduledCount = 0
  let scheduleState: 'scheduled' | 'urgent' | 'overdue' | undefined = undefined

  if (scheduleSummary && sessionIds.length > 0) {
    let totalSessions = 0
    let totalCount = 0
    let highestPriority = 0 // 0=none, 1=scheduled, 2=urgent, 3=overdue

    for (const id of sessionIds) {
      const entry = scheduleSummary.get(id)
      if (entry) {
        totalSessions += 1
        totalCount += entry.count
        const priority = entry.state === 'overdue' ? 3 : entry.state === 'urgent' ? 2 : 1
        if (priority > highestPriority) highestPriority = priority
      }
    }

    scheduledSessions = totalSessions
    scheduledCount = totalCount
    scheduleState = highestPriority === 3 ? 'overdue' : highestPriority === 2 ? 'urgent' : highestPriority === 1 ? 'scheduled' : undefined
  }

  // Waiting-review facts come from dsh-gitea-dispatch (its issue #16 public API).
  //
  // Counts **members**, not PRs: one session waits on exactly one PR, and the
  // badge's number must mean "how many sessions in this folder need attention".
  // `overdue` outranks `waiting` for the icon colour, mirroring the schedule rule.
  //
  // The fold itself is delegated to the publisher when it exports one: it owns the id
  // conventions, the state ranking and the deadline arithmetic, so consuming its
  // `summarizeWaitingGroup()` rather than re-deriving them here is what keeps the badge
  // from silently disagreeing with the row icon the same plugin draws.
  const waitingReview = waitingReviewSummary === undefined || sessionIds.length === 0
    ? undefined
    : (waitingReviewSummarize ?? summarizeWaitingGroupLocally)(waitingReviewSummary, sessionIds, now)
  const waitingReviewCount = waitingReview?.sessions ?? 0
  const waitingReviewState = waitingReview?.state
  const waitingReviewPrNumbers = waitingReview?.prNumbers ?? EMPTY_PR_NUMBERS
  const waitingReviewNextDeadline = waitingReview?.nextDeadline

  return {
    running, approval, planReview, question, done, subagents,
    scheduledSessions, scheduledCount, scheduleState,
    waitingReviewCount, waitingReviewState, waitingReviewPrNumbers, waitingReviewNextDeadline,
  }
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
 * @param waitingReviewSummary - dsh-gitea-dispatch waiting map, when that plugin is loaded.
 * @param scheduleSummary - dsh-later schedule map, when that plugin is loaded.
 * @param now - one clock reading shared by every group in the pass, so sibling badges
 *   cannot disagree about which deadlines are still ahead.
 * @param waitingReviewSummarize - dsh-gitea-dispatch's own group fold, when it exports one.
 */
export function directStatusesForGroups(
  groups: readonly { key: string; sessions: readonly SessionNode[] }[],
  waitingReviewSummary?: WaitingReviewSummaryMap,
  scheduleSummary?: ScheduleSummaryMap,
  now: number = Date.now(),
  waitingReviewSummarize?: WaitingReviewSummarizer,
): Map<string, GroupLiveStatus> {
  const map = new Map<string, GroupLiveStatus>()
  for (const group of groups) {
    map.set(group.key, summarizeGroupStatus(
      group.sessions, group.sessions.map(s => s.id), waitingReviewSummary, scheduleSummary,
      now, waitingReviewSummarize,
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
