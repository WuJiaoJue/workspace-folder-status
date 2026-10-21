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
 * hook，让"只用①不用②"在结构上写不出来，并且让这条接缝能被 `@testing-library/react`
 * 直接覆盖（本文件零宿主 import，宿主依赖闭包进不来）。
 *
 * ## 与协议的关系
 *
 * 本文件不认识任何具体来源：读的是登记面（`./facets.ts`），筛的是设置（`./facet-visibility.ts`）。
 * 提供方注册/注销、启用/停用插件，都只表现为版本号 +1。
 *
 * @module dsh-group-status/client/use-visible-facets
 */
import { useMemo, useSyncExternalStore } from 'react'
import type { ResolvedBadgeSettings } from './badge-settings.ts'
import type { FacetStore } from './facet-store.ts'
import type { RegisteredFacet } from './facets.ts'
import { visibleFacets } from './facet-visibility.ts'

/**
 * 当前**应当参与折叠**的登记来源，按登记面顺序（已按 `order` 排好）。
 *
 * @param store - facet 消费侧存储（`facetStore()` 单例）。
 * @param settings - 徽标设置；关掉的来源在折叠之前就被筛掉，数字、图标、`aria-label`
 *   与悬停明细因此同源。
 * @returns 可见登记项；引用在 `(版本, 设置)` 不变时保持稳定。
 */
export function useVisibleFacets(
  store: FacetStore,
  settings: ResolvedBadgeSettings,
): RegisteredFacet[] {
  // `getVersion` 返回 number，引用天然稳定，不会像"每次新建一个快照对象"那样把订阅打成
  // 死循环（React #185）。
  const version = useSyncExternalStore(store.subscribe, store.getVersion, store.getServerVersion)
  return useMemo(() => visibleFacets(store.list(), settings), [version, settings])
}
