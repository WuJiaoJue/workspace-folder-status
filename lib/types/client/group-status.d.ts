import type { GroupNode, SessionNode } from './tree.ts';
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
    readonly prNumber: number;
    readonly state: 'waiting' | 'overdue';
    /** Wait start (epoch ms from the Host state, ISO string across the wire). */
    readonly startedAt?: number | string;
    /** CI-declared wait window (seconds); absent = the duration is unknown. */
    readonly waitMaxSec?: number;
    /** CI-declared absolute deadline (epoch ms); preferred over `startedAt + waitMaxSec`. */
    readonly deadline?: number;
}
/** Session id → that session's waiting-review fact (no entry = not waiting). */
export type WaitingReviewSummaryMap = ReadonlyMap<string, WaitingReviewSummaryEntry>;
/**
 * Group-level fold of the waiting map: the shape dsh-gitea-dispatch publishes as
 * `summarizeWaitingGroup()` (issue: dsh-gitea-dispatch#16). Declared here as a
 * structural type so this plugin keeps no compile-time dependency on that package.
 */
export interface WaitingReviewFold {
    /** Members that are waiting. */
    sessions: number;
    /** PR numbers waited on, in the order the member ids were passed. */
    prNumbers: readonly number[];
    /** Highest-priority state across the group: overdue > waiting. */
    state: 'waiting' | 'overdue' | undefined;
    /** Earliest **still-future** deadline in the group; absent = nothing to count down to. */
    nextDeadline?: number;
}
/**
 * The publisher's own group fold, when its client half exports one.
 *
 * Used in preference to {@link summarizeWaitingGroupLocally}: the publisher owns the
 * id conventions, the state ranking and the deadline arithmetic, so delegating keeps
 * the badge from drifting the moment any of those change. The local fold is the
 * fallback for an older publisher that exports the map but not the aggregator.
 */
export type WaitingReviewSummarizer = (summary: WaitingReviewSummaryMap, sessionIds: readonly string[], now: number) => WaitingReviewFold;
/**
 * Absolute deadline of one waiting entry, in epoch ms; `undefined` = unknown duration.
 *
 * Mirrors the publisher's `deadlineOf` on purpose (absolute CI deadline first, only
 * then `startedAt + waitMaxSec`): the CI's own wait starts *before* the broadcast
 * reaches us, so a duration-only fallback would run the badge's countdown long past
 * the real deadline. Both `startedAt` shapes are accepted for the same reason.
 */
export declare function waitingDeadlineOf(entry: WaitingReviewSummaryEntry): number | undefined;
/**
 * Local stand-in for the publisher's group fold; see {@link WaitingReviewSummarizer}.
 *
 * Same lookup tolerance (all four id spellings, through `cross-plugin-summary`'s
 * `entryFor`, which is the publisher's `waitingEntryFor` rule), same ranking
 * (overdue outranks waiting), same "only future deadlines" rule for `nextDeadline`.
 */
export declare function summarizeWaitingGroupLocally(summary: WaitingReviewSummaryMap, sessionIds: readonly string[], now: number): WaitingReviewFold;
/**
 * One session's schedule fact, as published by dsh-later's `useScheduleSummary()`.
 */
export interface ScheduleSummaryEntry {
    readonly count: number;
    readonly pausedCount: number;
    readonly nextAt?: number;
    readonly state: 'scheduled' | 'urgent' | 'overdue';
}
/** Session id → that session's schedule fact (no entry = no scheduled tasks). */
export type ScheduleSummaryMap = ReadonlyMap<string, ScheduleSummaryEntry>;
/**
 * Aggregated live-session counts for one group, computed over all members so a
 * folded folder row can hint at hidden activity.
 */
export interface GroupLiveStatus {
    /** Members currently running. */
    running: number;
    /** Members awaiting tool approval. */
    approval: number;
    /** Members awaiting plan review. */
    planReview: number;
    /** Members awaiting a question answer. */
    question: number;
    /** Members finished and not yet opened (the green "done" reminder). */
    done: number;
    /** Running direct children across members. */
    subagents: number;
    /** Members with scheduled tasks (from dsh-later). */
    scheduledSessions: number;
    /** Total scheduled tasks across members (including paused). */
    scheduledCount: number;
    /** Highest-priority schedule state: overdue > urgent > scheduled. */
    scheduleState: 'scheduled' | 'urgent' | 'overdue' | undefined;
    /** Members waiting for CI review of their PR (from dsh-gitea-dispatch). */
    waitingReviewCount: number;
    /** Highest-priority waiting state across members: overdue > waiting. */
    waitingReviewState: 'waiting' | 'overdue' | undefined;
    /**
     * PR numbers the group is waiting on, one per waiting member (the publisher lists a PR
     * **per member**, so two members waiting on the same PR arrive twice, which is correct
     * here, and `badge-labels.ts` collapses them where the label reads). Folding folders
     * unions and sorts. Without this field the badge could say *that* a member waits but
     * never *what* it waits for.
     */
    waitingReviewPrNumbers: readonly number[];
    /**
     * Earliest still-future deadline across the group's waiting members (epoch ms).
     * Absent when every wait has an unknown duration or has already lapsed, which is
     * exactly when the badge must not render a countdown.
     */
    waitingReviewNextDeadline: number | undefined;
}
/**
 * Zero-valued sentinel for {@link GroupLiveStatus}.
 *
 * Used when a group is expanded (badge is hidden, so aggregation is wasted
 * work) or when no cross-plugin data is available. Kept as a frozen constant
 * so the reference is stable across renders — `Object.is` comparisons in
 * React selectors never trigger spurious re-renders on it.
 */
export declare const EMPTY_LIVE_STATUS: GroupLiveStatus;
/**
 * Merge two {@link GroupLiveStatus} objects by summing counters and taking the
 * highest-priority state (overdue > urgent > scheduled for schedule; overdue > waiting
 * for waiting-review).
 *
 * Used for multi-level aggregation: when a parent group is collapsed, its badge
 * must reflect all descendant sessions, not just direct members.
 */
export declare function mergeLiveStatus(a: GroupLiveStatus, b: GroupLiveStatus): GroupLiveStatus;
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
export declare function summarizeGroupStatus(nodes: readonly SessionNode[], sessionIds: readonly string[], waitingReviewSummary?: WaitingReviewSummaryMap, scheduleSummary?: ScheduleSummaryMap, now?: number, waitingReviewSummarize?: WaitingReviewSummarizer): GroupLiveStatus;
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
export declare function directStatusesForGroups(groups: readonly {
    key: string;
    sessions: readonly SessionNode[];
}[], waitingReviewSummary?: WaitingReviewSummaryMap, scheduleSummary?: ScheduleSummaryMap, now?: number, waitingReviewSummarize?: WaitingReviewSummarizer): Map<string, GroupLiveStatus>;
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
export declare function aggregateGroupStatuses(direct: ReadonlyMap<string, GroupLiveStatus>, childrenByParent: ReadonlyMap<string | undefined, readonly {
    key: string;
}[]>): Map<string, GroupLiveStatus>;
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
    liveStatus: GroupLiveStatus;
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
export declare function withAggregatedStatus(groups: readonly GroupNode[], direct: ReadonlyMap<string, GroupLiveStatus>, childrenByParent: ReadonlyMap<string | undefined, readonly GroupNode[]>): StatusedGroupNode[];
//# sourceMappingURL=group-status.d.ts.map