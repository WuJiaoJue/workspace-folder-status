/**
 * 把登记面读成「这一轮渲染该折哪些来源」的**唯一**一处接线。
 *
 * ## 为什么单独成文
 *
 * 这一步此前直接写在 `rows/WorkspaceBrowser.tsx` 里，两行：
 *
 * ```ts
 * useSyncExternalStore(facetsStore.subscribe, facetsStore.getVersion, …)   // 返回值丢掉
 * const facets = useMemo(() => visibleFacets(facetsStore.list(), settings), [settings])
 * ```
 *
 * 看着没问题——订阅了、也 memo 了。实际是**订阅通知只重渲染、不重算**：
 * `useSyncExternalStore` 的返回值被丢掉，`useMemo` 的依赖里就没有任何东西随登记面变化，
 * 于是那次重渲染原样拿回**上一次**的登记面。提供方在自己的 `apply` 里注册，而宿主不保证
 * `apply` 与本组件首渲染的先后：注册**晚于**首渲染时，facet 明明登记上了，却永远进不了
 * 徽标——不报错、不红测试（能渲染这条路径的那份上游 spec 在本仓库是跳过的，见
 * `vitest.config.ts` 的 `MONOREPO_ONLY_SPECS`），只能靠刷新页面碰运气。
 *
 * 版本号必须**同时**当两件事用：① 触发重渲染的信号，② memo 的依赖。这里把它收进一个
 * hook，让「只用①、丢掉②」在结构上写不出来，并且让这条接缝能被 `@testing-library/react`
 * 直接覆盖（本文件零宿主 import，宿主依赖闭包进不来）。
 *
 * ## 为什么现在不再按设置筛
 *
 * 旧版本这里会过一道 `visibleFacets(list, settings)`，按 `facet.settingKey` 查本插件的
 * 布尔开关。那意味着**本插件的配置面里写着别人家的语义**（`showScheduledInBadge` /
 * `showWaitingReviewInBadge`，连图标形状都替对方写死），与"本插件不认识任何来源"直接
 * 矛盾。现在外部来源的显隐归**来源自己**：它想被关掉就不注册 facet，登记面即所见。
 * 本插件的开关只管自己那三档会话状态（见 `badge-settings.ts`）。
 *
 * @module dsh-group-status/client/use-registered-facets
 */
import { useMemo, useSyncExternalStore } from 'react'
import type { FacetStore } from './facet-store.ts'
import type { RegisteredFacet } from './facets.ts'

/**
 * 当前登记的来源，按登记面顺序（已按 `order` 排好）。
 *
 * 引用在版本号不变时保持稳定：登记面是低频事件，重算成本 = O(facet × 组内会话)。
 *
 * @param store - facet 消费侧存储（`facetStore()` 单例）。
 */
export function useRegisteredFacets(store: FacetStore): RegisteredFacet[] {
  // `getVersion` 返回 number，引用天然稳定，不会像"每次新建一个快照对象"那样把订阅打成
  // 死循环（React #185）。
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getServerVersion)
  return useMemo(() => [...store.list()], [version])
}
