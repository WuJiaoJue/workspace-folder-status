import { defaultMergeFold } from "./facets.js";
/** 空折果表：让哨兵的引用跨渲染稳定。 */
const EMPTY_FACETS = new Map();
/**
 * Zero-valued sentinel for {@link GroupLiveStatus}.
 *
 * Used when a group has nothing to report. Kept as a frozen constant so the
 * reference is stable across renders — `Object.is` comparisons in React selectors
 * never trigger spurious re-renders on it.
 */
export const EMPTY_LIVE_STATUS = Object.freeze({
    running: 0, approval: 0, planReview: 0, question: 0, done: 0, subagents: 0,
    facets: EMPTY_FACETS,
});
/**
 * 合并两份分组折果：本插件自己的计数相加，外部状态来源**按 facet 各自合并**。
 *
 * 用于多层聚合：折叠的父文件夹要覆盖整棵子树，而子树里每一层都已各自折过一遍。
 * `FacetFold.data` 怎么合归该 facet 自己决定，本模块从不解释。
 */
export function mergeLiveStatus(a, b) {
    return {
        running: a.running + b.running,
        approval: a.approval + b.approval,
        planReview: a.planReview + b.planReview,
        question: a.question + b.question,
        done: a.done + b.done,
        subagents: a.subagents + b.subagents,
        facets: mergeFacets(a.facets, b.facets),
    };
}
/** 按 facet id 合并两侧折果；只有一侧有的来源原样带过。 */
function mergeFacets(a, b) {
    if (a.size === 0)
        return b;
    if (b.size === 0)
        return a;
    const merged = new Map(a);
    for (const [id, entry] of b) {
        const own = merged.get(id);
        // 合并规则由该来源自己声明；缺省只加数量、取更紧急的色档、脉冲取或。
        // 合并后仍沿用先登记那一份的 facet 引用：两侧本就是同一个来源。
        merged.set(id, own === undefined
            ? entry
            : { facet: own.facet, fold: own.facet.merge?.(own.fold, entry.fold) ?? defaultMergeFold(own.fold, entry.fold) });
    }
    return merged;
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
export function summarizeGroupStatus(nodes, sessionIds, facets = [], now = Date.now()) {
    let running = 0;
    let approval = 0;
    let planReview = 0;
    let question = 0;
    let done = 0;
    let subagents = 0;
    for (const n of nodes) {
        if (n.blank || n.archived)
            continue;
        if (n.pendingInteraction === 'approval') {
            approval += 1;
            continue;
        }
        if (n.pendingInteraction === 'plan-review') {
            planReview += 1;
            continue;
        }
        if (n.pendingInteraction === 'question') {
            question += 1;
            continue;
        }
        if (n.running)
            running += 1;
        else if (n.completed)
            done += 1;
        subagents += n.runningSubagentCount;
    }
    // 外部来源逐个折。一个来源坏了不该带塌整只徽标：快照读失败按「此刻没有数据」处理，
    // 折叠抛错则跳过该来源——两者都不往渲染管线里扩散。
    const folded = new Map();
    for (const { facet } of facets) {
        let snapshot;
        try {
            snapshot = facet.getSnapshot();
        }
        catch {
            snapshot = undefined;
        }
        try {
            const result = facet.fold(snapshot, sessionIds, now);
            // `count <= 0` 的来源不进表：数字、图标、文案、显隐判定都当它不存在。
            if (result !== undefined && result.count > 0)
                folded.set(facet.id, { facet, fold: result });
        }
        catch {
            /* 同上：这个来源此刻不参与徽标 */
        }
    }
    return { running, approval, planReview, question, done, subagents, facets: folded };
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
export function directStatusesForGroups(groups, facets = [], now = Date.now()) {
    const map = new Map();
    for (const group of groups) {
        map.set(group.key, summarizeGroupStatus(group.sessions, group.sessions.map(s => s.id), facets, now));
    }
    return map;
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
export function aggregateGroupStatuses(direct, childrenByParent) {
    const aggregated = new Map();
    // Parentage comes from path-prefix matching, so a self- or mutual-parent edge is
    // representable; without this guard the fold would recurse forever and hang the sidebar.
    const visiting = new Set();
    const fold = (key) => {
        const cached = aggregated.get(key);
        if (cached !== undefined)
            return cached;
        if (visiting.has(key))
            return direct.get(key) ?? EMPTY_LIVE_STATUS;
        visiting.add(key);
        let total = direct.get(key) ?? EMPTY_LIVE_STATUS;
        for (const child of childrenByParent.get(key) ?? []) {
            total = mergeLiveStatus(total, fold(child.key));
        }
        visiting.delete(key);
        aggregated.set(key, total);
        return total;
    };
    // Every listed child is folded, not just the roots: an unreachable group would
    // otherwise be missing from the map and lose its badge.
    for (const children of childrenByParent.values()) {
        for (const child of children)
            fold(child.key);
    }
    return aggregated;
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
export function withAggregatedStatus(groups, direct, childrenByParent) {
    const aggregated = aggregateGroupStatuses(direct, childrenByParent);
    // A group missing from the fold has neither measured members nor listed children,
    // so it is idle rather than unknown.
    return groups.map(group => ({ ...group, liveStatus: aggregated.get(group.key) ?? EMPTY_LIVE_STATUS }));
}
//# sourceMappingURL=group-status.js.map