/**
 * facet 的**消费侧**：把「登记表面 + 每个 facet 自己的外部存储」压成一份 React 可订阅的
 * 单一存储。
 *
 * ## 为什么必须是一个存储，而不是逐个 hook
 *
 * 见 `./facets.ts` 的文件头：hook 数量在同一个组件里必须逐次渲染恒定，而 facet 是运行
 * 时注册/注销的。所以这里只暴露一个**版本号**（数字，引用天然稳定）给
 * `useSyncExternalStore`，实际的快照读取与折叠都发生在渲染期。
 *
 * ## 快照读取为什么放在渲染期
 *
 * `getSnapshot` 必须返回稳定引用，而「每个 facet 的快照」是一个对象图：为它造一个
 * 缓存就需要判定失效，而判定失效又要读快照本身。改成「版本号变 → 重新渲染 → 现读现折」
 * 之后，缓存问题消失，代价是一次 O(facet × 组内会话) 的纯计算，量级与原有实现相同。
 *
 * @module dsh-group-status/client/facet-store
 */
import { type FacetRegistry, type RegisteredFacet } from './facets.ts';
/** {@link createFacetStore} 的产物。 */
export interface FacetStore {
    /** 订阅「快照可能变了」或「登记面变了」。 */
    subscribe(listener: () => void): () => void;
    /** 单调递增的版本号；引用天然稳定，可直接作为 `useSyncExternalStore` 的快照。 */
    getVersion(): number;
    /** 服务端渲染快照：与 {@link getVersion} 同型，避免 hydration 不一致。 */
    getServerVersion(): number;
    /** 当前登记项（已排序）。 */
    list(): readonly RegisteredFacet[];
    /** 释放所有对 facet 存储的订阅（宿主卸载本插件时调用）。 */
    dispose(): void;
}
/**
 * 创建 facet 存储。
 *
 * 对登记面做一次订阅，并在登记变化时**重新接线**各 facet 的 `subscribe`：provider 热替换
 * 实现（同 id 再注册）或运行中启用/停用插件，都只会走到这里一次，不会留下野订阅。
 *
 * @param source - 登记表面；缺省用模块级单例，测试传入自建实例以隔离。
 */
export declare function createFacetStore(source?: FacetRegistry): FacetStore;
/** 取（并首次创建）单例存储。 */
export declare function facetStore(): FacetStore;
/** 释放单例存储（插件卸载时调用；下次 {@link facetStore} 会重建）。 */
export declare function disposeFacetStore(): void;
//# sourceMappingURL=facet-store.d.ts.map