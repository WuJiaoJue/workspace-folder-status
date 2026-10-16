import { type FacetRegistry, type Unregister } from '../facets.ts';
import type { LegacyFacetSources } from './store-source.ts';
/**
 * 登记本插件目前**代管**的状态源。
 *
 * 两个 facet 都显式声明 `origin: 'legacy'`，所以状态所有者一旦自己注册同名 facet，
 * 适配器就让位（{@link FACET_ORIGIN_RANK}），不会重复计数。
 *
 * @returns 一次性注销函数（挂到 `ctx.effect` 的清理上）。
 */
export declare function registerLegacyFacets(sources: LegacyFacetSources, target?: FacetRegistry): Unregister;
/** 本插件目前代管了哪些状态源（诊断与测试用）。 */
export declare const LEGACY_FACET_IDS: readonly string[];
//# sourceMappingURL=register-legacy-facets.d.ts.map