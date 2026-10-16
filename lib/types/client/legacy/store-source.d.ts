/**
 * 过渡期桥接层里**与图标无关**的那一半。
 *
 * 单独成文只为一件事：可测。`register-legacy-facets.tsx` 引宿主图标集，它的 `require`
 * 图在本仓库里解析不了（`vitest.config.ts` 排除理由 (b)）。"store 迟到怎么办"和"设置
 * 关掉哪个来源"都是真会咬人的逻辑，跟图标写在一起就永远进不了测试。
 *
 * @module dsh-group-status/client/legacy/store-source
 */
import { type ResolvedBadgeSettings } from '../badge-settings.ts';
import type { RegisteredFacet } from '../facets.ts';
import type { ScheduleSummaryMap } from './schedule.ts';
import type { WaitingReviewSummarizer, WaitingReviewSummaryMap } from './waiting-review.ts';
/**
 * 把「store 可能迟到」的两层订阅合成一个稳定订阅面。
 *
 * @param getStore - 读当前生效的 store（未登记时 undefined）。
 * @param subscribeRegistry - 订阅 store 登记变化（提供方 apply 晚于本插件渲染时用它自愈）。
 */
export declare function bridgeLateStoreSource<Snapshot>(getStore: (() => {
    getSnapshot: () => Snapshot | undefined;
    subscribe: (listener: () => void) => () => void;
} | undefined) | undefined, subscribeRegistry: ((listener: () => void) => () => void) | undefined): {
    subscribe: (listener: () => void) => () => void;
    getSnapshot: () => Snapshot | undefined;
} | undefined;
/**
 * 安装两个过渡适配器。
 *
 * @returns 一次性注销函数（挂到 `ctx.effect` 的清理上）。

/**
 * 按设置筛掉被关掉的来源。
 *
 * 过滤放在**折叠之前**而不是渲染阶段：数字、图标、`aria-label`、悬停明细与"要不要画
 * 徽标"因此天然同源，不会出现在 label 里有、计数里没有的情况。
 */
export declare function visibleFacets(entries: readonly RegisteredFacet[], settings: ResolvedBadgeSettings): RegisteredFacet[];
/** 提供方 store 的最小面（两家同形：宿主 `useSyncExternalStore` 的外部存储）。 */
export interface ProviderStore<Snapshot> {
    getSnapshot: () => Snapshot | undefined;
    subscribe: (listener: () => void) => () => void;
}
/** 两家 provider 的 client 导出面里，桥接层真正用到的部分。 */
export interface LegacyProviderClients {
    /** 缺席（未安装 / 未启用）就整个省略这个键。 */
    later?: {
        getScheduleSummaryStore?: () => ProviderStore<ScheduleSummaryMap> | undefined;
        subscribeScheduleSummaryStore?: (listener: () => void) => () => void;
    };
    /** 同上。 */
    dispatch?: {
        getWaitingSummaryStore?: () => ProviderStore<WaitingReviewSummaryMap> | undefined;
        subscribeWaitingSummaryStore?: (listener: () => void) => () => void;
        summarizeWaitingGroup?: WaitingReviewSummarizer;
    };
}
/** 交给图标层的装配入参（见 `register-legacy-facets.tsx`）。 */
export interface LegacyFacetSources {
    schedule: {
        subscribe: (listener: () => void) => () => void;
        getSnapshot: () => ScheduleSummaryMap | undefined;
    } | undefined;
    waiting: {
        subscribe: (listener: () => void) => () => void;
        getSnapshot: () => WaitingReviewSummaryMap | undefined;
        summarize?: WaitingReviewSummarizer;
    } | undefined;
}
/**
 * 从两家 provider 的 client 面拼出登记入参。
 *
 * 这一层刻意不碰图标、不 `require`：它是桥接里唯一"会拼错"的部分（store 迟到、
 * 谁缺席、委托哪个聚合函数），能被测试覆盖才有意义。`require` 与图标各自留在只有一行
 * 调用的 `bridge.ts` 与 `register-legacy-facets.tsx` 里。
 */
export declare function assembleLegacySources(clients: LegacyProviderClients): LegacyFacetSources;
//# sourceMappingURL=store-source.d.ts.map