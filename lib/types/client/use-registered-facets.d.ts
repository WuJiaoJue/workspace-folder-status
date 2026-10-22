import type { FacetStore } from './facet-store.ts';
import type { RegisteredFacet } from './facets.ts';
/**
 * 当前登记的来源，按登记面顺序（已按 `order` 排好）。
 *
 * 引用在版本号不变时保持稳定：登记面是低频事件，重算成本 = O(facet × 组内会话)。
 *
 * @param store - facet 消费侧存储（`facetStore()` 单例）。
 */
export declare function useRegisteredFacets(store: FacetStore): RegisteredFacet[];
//# sourceMappingURL=use-registered-facets.d.ts.map