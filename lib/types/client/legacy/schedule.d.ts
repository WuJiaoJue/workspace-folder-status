/**
 * 过渡期适配器：dsh-later 的「定时任务」→ facet。
 *
 * ⚠️ 与 `waiting-review.ts` 同属临时层，dsh-later 自己注册之后连同图标映射一并删除。
 * 见其 issue #17（摘要 API）与本次的升级请求。
 *
 * @module dsh-group-status/client/legacy/schedule
 */
import type { FacetFold, FacetRenderContext, GroupStatusFacet } from '../facets.ts';
/** facet id：与 dsh-later 自己注册时应当使用的 id 保持一致。 */
export declare const SCHEDULE_FACET_ID = "dsh-later.schedule";
/** 一条定时任务事实，来自 dsh-later 的 `useScheduleSummary()`。 */
export interface ScheduleSummaryEntry {
    readonly count: number;
    readonly pausedCount: number;
    readonly nextAt?: number;
    readonly state: 'scheduled' | 'urgent' | 'overdue';
}
/** 会话 id → 该会话的定时任务事实。 */
export type ScheduleSummaryMap = ReadonlyMap<string, ScheduleSummaryEntry>;
/** 定时折果携带的数据：只有本 facet 读。 */
export interface ScheduleData {
    /** 组内定时任务总条数（含已暂停）。 */
    readonly tasks: number;
    /** 组内最高优先级状态：overdue > urgent > scheduled。 */
    readonly state: 'scheduled' | 'urgent' | 'overdue' | undefined;
}
/**
 * 把一组的会话 id 折成定时任务事实。
 *
 * `count` 用**有条目的会话数**（与徽标"还需要看几件事"的口径一致），任务总数留在
 * `data.tasks` 里供文案/明细使用。
 */
export declare function foldSchedule(snapshot: ScheduleSummaryMap | undefined, sessionIds: readonly string[]): FacetFold<ScheduleData>;
/** 跨层合并：会话数与任务数相加，状态取更紧急的一档。 */
export declare function mergeScheduleFold(a: FacetFold<ScheduleData>, b: FacetFold<ScheduleData>): FacetFold<ScheduleData>;
/** 「N 定时任务」：措辞沿用本插件的行级文案键。 */
export declare function scheduleLabel(fold: FacetFold<ScheduleData>, context: FacetRenderContext): string;
/**
 * 构造内置的定时任务 facet。
 *
 * @param input.getSnapshot - 读 dsh-later 的摘要 Map。
 * @param input.subscribe - 订阅其变化。
 */
export declare function createScheduleFacet(input: {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => ScheduleSummaryMap | undefined;
}): GroupStatusFacet<ScheduleSummaryMap | undefined, ScheduleData>;
//# sourceMappingURL=schedule.d.ts.map