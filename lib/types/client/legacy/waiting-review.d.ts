import type { FacetFold, FacetRenderContext, GroupStatusFacet } from '../facets.ts';
/** facet id：与 dsh-gitea-dispatch 自己注册时应当使用的 id 保持一致。 */
export declare const WAITING_REVIEW_FACET_ID = "dsh-gitea-dispatch.waiting-review";
/**
 * 一条等待评审事实，来自 dsh-gitea-dispatch 的 `useWaitingSummary()`
 * （issue: dsh-gitea-dispatch#16）。
 *
 * 可选字段是提供方契约的一部分：正是它们让徽标能说「在等哪个 PR」「还剩多久」。
 * 本类型此前只声明 `{ prNumber, state }`，于是提供方已经取回的信息被静默丢掉。
 */
export interface WaitingReviewSummaryEntry {
    readonly prNumber: number;
    readonly state: 'waiting' | 'overdue';
    /** 等待起点（宿主 state 里是 epoch ms，过 wire 可能是 ISO 字符串）。 */
    readonly startedAt?: number | string;
    /** CI 声明的等待上限（秒）；缺省 = 时长未知。 */
    readonly waitMaxSec?: number;
    /** CI 声明的绝对截止（epoch ms）；优先于 `startedAt + waitMaxSec`。 */
    readonly deadline?: number;
}
/** 会话 id → 该会话的等待事实（没有条目 = 没在等）。 */
export type WaitingReviewSummaryMap = ReadonlyMap<string, WaitingReviewSummaryEntry>;
/** 提供方 `summarizeWaitingGroup()` 的折果形状。 */
export interface WaitingReviewFold {
    /** 组内**在等**的会话数。 */
    sessions: number;
    /** 组内在等的 PR 号（按传入会话顺序）。 */
    prNumbers: readonly number[];
    /** 组内最高优先级状态：overdue > waiting。 */
    state: 'waiting' | 'overdue' | undefined;
    /** 组内**尚未到点**的最早截止（epoch ms）；无则缺省。 */
    nextDeadline?: number;
}
/** 提供方的分组聚合函数面。 */
export type WaitingReviewSummarizer = (summary: WaitingReviewSummaryMap, sessionIds: readonly string[], now: number) => WaitingReviewFold;
/** 等待折果携带的数据：徽标从不解释它，只有本 facet 读。 */
export interface WaitingReviewData {
    readonly prNumbers: readonly number[];
    readonly state: 'waiting' | 'overdue' | undefined;
    readonly nextDeadline?: number;
}
/**
 * 一条等待的绝对截止（epoch ms）；`undefined` = 时长未知。
 *
 * 刻意与提供方的 `deadlineOf` 同口径（绝对 deadline 优先，才退 `startedAt + waitMaxSec`）：
 * CI 的等待从"进入循环"起算，而广播在此之前已发出，只按时长算会让徽标的倒计时晚于
 * 真实截止（其 Issues #2577）。`startedAt` 的两种形态同理都要认。
 */
export declare function waitingDeadlineOf(entry: WaitingReviewSummaryEntry): number | undefined;
/**
 * 提供方聚合面缺席时的等价折叠。
 *
 * 与提供方的 `summarizeWaitingGroup()` 同一套判据：四形态 id 兜底（复用
 * `cross-plugin-summary.ts` 的 `entryFor`，规则与它的 `waitingEntryFor` 相同）、
 * `overdue > waiting` 排序、只把**未到期**的截止算作 `nextDeadline`。
 */
export declare function summarizeWaitingGroupLocally(summary: WaitingReviewSummaryMap, sessionIds: readonly string[], now: number): WaitingReviewFold;
/**
 * 同 facet 跨层合并：PR 号取并集去重升序、色档取更紧急的一档、
 * 倒计时取两侧更早的那个未到期截止。
 */
export declare function mergeWaitingReviewFold(a: FacetFold<WaitingReviewData>, b: FacetFold<WaitingReviewData>): FacetFold<WaitingReviewData>;
/** `#15, #2783(+2)`：去重升序、封顶三个。 */
export declare function prNumberList(prNumbers: readonly number[] | undefined): string;
/**
 * 等待评审那一句文案：状态 + 剩余时长（分钟粒度）+ PR 号。
 *
 * 措辞与提供方自己的行内呈现同档（`等待评审 3:28` / `评审等待已超时` / `等待评审结果`），
 * 但只到分钟：徽标只在提供方 store 通知时重渲染，秒级读数会停在旧值上撒谎。
 */
export declare function waitingReviewLabel(fold: FacetFold<WaitingReviewData>, context: FacetRenderContext): string;
/**
 * 构造本插件内置的等待评审 facet。
 *
 * @param input - 提供方的摘要读取面；`summarize` 缺席时退回本地等价折叠。
 * @param input.subscribe - 订阅快照变化（提供方 store 的订阅面）。
 * @param input.getSnapshot - 读当前摘要 Map。
 * @param input.summarize - 提供方的分组聚合（有则委托）。
 */
export declare function createWaitingReviewFacet(input: {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => WaitingReviewSummaryMap | undefined;
    summarize?: WaitingReviewSummarizer;
}): GroupStatusFacet<WaitingReviewSummaryMap | undefined, WaitingReviewData>;
//# sourceMappingURL=waiting-review.d.ts.map