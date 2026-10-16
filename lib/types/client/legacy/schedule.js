import { GROUP_STATUS_FACET_PROTOCOL_VERSION } from "../facets.js";
/** facet id：与 dsh-later 自己注册时应当使用的 id 保持一致。 */
export const SCHEDULE_FACET_ID = 'dsh-later.schedule';
/** 状态优先级（越大越紧急），与 dsh-later 的行内口径一致。 */
const SCHEDULE_RANK = {
    scheduled: 1, urgent: 2, overdue: 3,
};
/**
 * 把一组的会话 id 折成定时任务事实。
 *
 * `count` 用**有条目的会话数**（与徽标"还需要看几件事"的口径一致），任务总数留在
 * `data.tasks` 里供文案/明细使用。
 */
export function foldSchedule(snapshot, sessionIds) {
    let sessions = 0;
    let tasks = 0;
    let state;
    if (snapshot !== undefined) {
        for (const id of sessionIds) {
            const entry = snapshot.get(id);
            if (entry === undefined)
                continue;
            sessions += 1;
            tasks += entry.count;
            if (state === undefined || SCHEDULE_RANK[entry.state] > SCHEDULE_RANK[state])
                state = entry.state;
        }
    }
    return {
        count: sessions,
        tone: state === 'overdue' ? 'error' : state === 'urgent' ? 'warn' : 'info',
        // 提醒已过点 / 五分钟内到点 = 真的在催用户，这是脉冲的唯一合法用途。
        pulse: state === 'overdue' || state === 'urgent',
        data: { tasks, state },
    };
}
/** 跨层合并：会话数与任务数相加，状态取更紧急的一档。 */
export function mergeScheduleFold(a, b) {
    const rankA = a.data?.state === undefined ? 0 : SCHEDULE_RANK[a.data.state];
    const rankB = b.data?.state === undefined ? 0 : SCHEDULE_RANK[b.data.state];
    const state = rankB > rankA ? b.data?.state : a.data?.state;
    return {
        count: a.count + b.count,
        tone: state === 'overdue' ? 'error' : state === 'urgent' ? 'warn' : 'info',
        pulse: a.pulse || b.pulse,
        data: { tasks: (a.data?.tasks ?? 0) + (b.data?.tasks ?? 0), state },
    };
}
/** 「N 定时任务」：措辞沿用本插件的行级文案键。 */
export function scheduleLabel(fold, context) {
    return `${fold.count} ${context.t('status.scheduled')}`;
}
/**
 * 构造内置的定时任务 facet。
 *
 * @param input.getSnapshot - 读 dsh-later 的摘要 Map。
 * @param input.subscribe - 订阅其变化。
 */
export function createScheduleFacet(input) {
    return {
        protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION,
        id: SCHEDULE_FACET_ID,
        origin: 'legacy',
        settingKey: 'showScheduledInBadge',
        order: 10,
        subscribe: input.subscribe,
        getSnapshot: input.getSnapshot,
        fold: (snapshot, sessionIds) => foldSchedule(snapshot, sessionIds),
        merge: mergeScheduleFold,
        label: scheduleLabel,
    };
}
//# sourceMappingURL=schedule.js.map