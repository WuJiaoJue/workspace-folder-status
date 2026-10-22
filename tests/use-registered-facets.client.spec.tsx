/**
 * `useRegisteredFacets` 的回归用例：这条接缝是「登记面变化 → 徽标看见它」的唯一通路。
 *
 * ## 为什么单独测它，而不是在 `WorkspaceBrowser` 里测
 *
 * 能渲染整条侧栏路径的那份上游 spec（`tests/workspace-browser.client.spec.tsx`）在本仓库
 * 是**跳过**的——它要宿主应用的依赖闭包（见 `vitest.config.ts` 的 `MONOREPO_ONLY_SPECS`）。
 * 于是「订阅了、也 memo 了，但 memo 的依赖里没有版本号」这类错**结构上测不到**：
 * 订阅只换来一次重渲染，渲染算的却还是上一次的登记面。表现就是提供方注册成功了、
 * 徽标却永远少它一家，而且只有刷新页面才好。
 *
 * 把订阅 + 读表收进这一个 hook，接缝就落到了能跑 `@testing-library/react` 的那一层。
 *
 * ## 这里同时钉住"本插件不再筛外部来源"
 *
 * 旧 hook 会按 `facet.settingKey` 查本插件的布尔开关，于是本插件的配置面里写着
 * `showScheduledInBadge` / `showWaitingReviewInBadge` 两个别人家的域名（连图标形状都
 * 替对方写死）。那条路已删：登记即显示，显隐归来源自己。下面「废弃的 settingKey 不再
 * 筛掉任何来源」一条就是这条新规则的回归守卫。
 */
// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_BADGE_SETTINGS } from '../src/client/badge-settings.ts'
import { createFacetStore } from '../src/client/facet-store.ts'
import { createFacetRegistry } from '../src/client/facets.ts'
import { bindableFacet } from './support/facets.ts'
import { useRegisteredFacets } from '../src/client/use-registered-facets.ts'

afterEach(cleanup)

/** 一个来源的登记项 id（断言只看 id，不比对对象引用）。 */
const ids = (entries: readonly { facet: { id: string } }[]): string[] => entries.map(entry => entry.facet.id)

describe('useRegisteredFacets', () => {
  it('登记面在首渲染**之后**才变化时，新来源照样出现在下一轮渲染里', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    const { result } = renderHook(() => useRegisteredFacets(store))

    // 首渲染时表是空的：这正是「提供方比本组件晚 apply」那一次的起点。
    expect(result.current).toEqual([])

    // 回归点：这一句在旧接线下不会让 `result.current` 变化——订阅只触发了重渲染，
    // memo 的依赖里没有版本号，于是它原样交回空表。
    act(() => {
      registry.register(bindableFacet('x.late'))
    })
    expect(ids(result.current)).toEqual(['x.late'])
  })

  it('注销同样即时生效，不给徽标留一个折不动的死来源', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    registry.register(bindableFacet('x.goes'))
    const { result } = renderHook(() => useRegisteredFacets(store))
    expect(ids(result.current)).toEqual(['x.goes'])

    act(() => {
      registry.remove('x.goes')
    })
    expect(result.current).toEqual([])
  })

  it('来源自己存储的变更也触发重算（提供方换快照，登记面不变）', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    let notify: (() => void) | undefined
    registry.register(bindableFacet('x.push', {
      subscribe: (listener: () => void) => {
        notify = listener
        return () => { notify = undefined }
      },
    }))
    const { result } = renderHook(() => useRegisteredFacets(store))
    expect(ids(result.current)).toEqual(['x.push'])

    // 登记面没变，变的是提供方的存储：版本号仍要 +1，消费侧才会重新读表。
    act(() => { notify?.() })
    expect(ids(result.current)).toEqual(['x.push'])
  })

  it('废弃的 `settingKey` 不再筛掉任何来源：登记即显示', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    // 一个仍然按旧协议声明 settingKey 的提供方（v1 兼容：字段保留、不再被读取）。
    registry.register(bindableFacet('x.legacy-key', { settingKey: 'showWaitingReviewInBadge' }))
    const { result } = renderHook(() => useRegisteredFacets(store))
    expect(ids(result.current)).toEqual(['x.legacy-key'])
    // 本插件的设置面里已经没有那个键了 —— 它不该、也无法关掉这个来源。
    expect(DEFAULT_BADGE_SETTINGS).not.toHaveProperty('showWaitingReviewInBadge')
  })

  it('登记面没变时交出同一个引用（徽标不该为此重算）', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    registry.register(bindableFacet('x.stable'))
    const { result, rerender } = renderHook(() => useRegisteredFacets(store))
    const first = result.current
    rerender()
    expect(result.current).toBe(first)
  })
})
