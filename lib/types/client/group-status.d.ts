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
import type { AnyFacet, AnyFacetFold, RegisteredFacet } from './facets.ts';
import type { GroupNode, SessionNode } from './tree.ts';
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
    /**
     * 外部状态源的折果，按 facet id 索引，只含**有贡献**的来源（`count > 0`）。
     *
     * 这里刻意没有 `scheduled*` / `waitingReview*` 这类具名字段：徽标一旦为某个来源开
     * 一个字段，就等于把别人家的语义焊进自己的类型，新增来源就得改本插件。
     * `FacetFold.data` 的形状只有该来源自己读。
     */
    facets: ReadonlyMap<string, FacetEntry>;
}
/**
 * 一个来源在**这一组**上的折果，连同它自己的 facet。
 *
 * 带上 facet 是为了让渲染（文案、图标、脉冲）与多层合并（`facet.merge`）都不必再回
 * 登记面查表——也就不需要任何模块级状态。
 */
export interface FacetEntry {
    facet: AnyFacet;
    fold: AnyFacetFold;
}
/**
 * Zero-valued sentinel for {@link GroupLiveStatus}.
 *
 * Used when a group has nothing to report. Kept as a frozen constant so the
 * reference is stable across renders — `Object.is` comparisons in React selectors
 * never trigger spurious re-renders on it.
 */
export declare const EMPTY_LIVE_STATUS: GroupLiveStatus;
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
export declare function mergeLiveStatus(a: GroupLiveStatus, b: GroupLiveStatus): GroupLiveStatus;
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
export declare function summarizeGroupStatus(nodes: readonly SessionNode[], sessionIds: readonly string[], facets?: readonly RegisteredFacet[], now?: number): GroupLiveStatus;
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
export declare function directStatusesForGroups(groups: readonly {
    key: string;
    sessions: readonly SessionNode[];
}[], facets?: readonly RegisteredFacet[], now?: number): Map<string, GroupLiveStatus>;
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