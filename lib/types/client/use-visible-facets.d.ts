import type { ResolvedBadgeSettings } from './badge-settings.ts';
import type { FacetStore } from './facet-store.ts';
import type { RegisteredFacet } from './facets.ts';
/**
 * 当前**应当参与折叠**的登记来源，按登记面顺序（已按 `order` 排好）。
 *
 * @param store - facet 消费侧存储（`facetStore()` 单例）。
 * @param settings - 徽标设置；关掉的来源在折叠之前就被筛掉，数字、图标、`aria-label`
 *   与悬停明细因此同源。
 * @returns 可见登记项；引用在 `(版本, 设置)` 不变时保持稳定。
 */
export declare function useVisibleFacets(store: FacetStore, settings: ResolvedBadgeSettings): RegisteredFacet[];
//# sourceMappingURL=use-visible-facets.d.ts.map