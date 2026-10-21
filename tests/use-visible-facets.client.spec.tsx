/**
 * `useVisibleFacets` 的回归用例：这条接缝是「登记面变化 → 徽标看见它」的唯一通路。
 *
 * ## 为什么单独测它，而不是在 `WorkspaceBrowser` 里测
 *
 * 能渲染整条侧栏路径的那份上游 spec（`tests/workspace-browser.client.spec.tsx`）在本仓库
 * 是**跳过**的——它要宿主应用的依赖闭包（见 `vitest.config.ts` 的 `MONOREPO_ONLY_SPECS`）。
 * 于是「订阅了、也 memo 了，但 memo 的依赖里没有版本号」这类错**结构上测不到**：
 * 订阅只换来一次重渲染，渲染算的却还是上一次的登记面。表现就是提供方注册成功了、
 * 徽标却永远少它一家，而且只有刷新页面才好。
 *
 * 把订阅 + 读表 + 按设置筛收进这一个 hook，接缝就落到了能跑 `@testing-library/react`
 * 的那一层，这条回归也随之可测。
 */
// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_BADGE_SETTINGS, type ResolvedBadgeSettings } from '../src/client/badge-settings.ts'
import { createFacetStore } from '../src/client/facet-store.ts'
import { createFacetRegistry } from '../src/client/facets.ts'
import { bindableFacet } from './support/facets.ts'
import { useVisibleFacets } from '../src/client/use-visible-facets.ts'

afterEach(cleanup)

/** 一个来源的登记项 id（断言只看 id，不比对对象引用）。 */
const ids = (entries: readonly { facet: { id: string } }[]): string[] => entries.map(entry => entry.facet.id)

describe('useVisibleFacets', () => {
  it('登记面在首渲染**之后**才变化时，新来源照样出现在下一轮渲染里', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    const { result } = renderHook(() => useVisibleFacets(store, DEFAULT_BADGE_SETTINGS))

    // 首渲染时表是空的：这正是「提供方比本组件晚 apply」那一次的起点。
    expect(result.current).toEqual([])

    // 回归点：这一句在旧接线下不会让 `result.current` 变化——订阅只触发了重渲染，
    // memo 的依赖里没有版本号，于是它原样交回空表。
    const facet = bindableFacet('x.late')
    act(() => {
      registry.register(facet)
    })
    expect(ids(result.current)).toEqual(['x.late'])
  })

  it('注销同样即时生效，不给徽标留一个折不动的死来源', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    registry.register(bindableFacet('x.goes'))
    const { result } = renderHook(() => useVisibleFacets(store, DEFAULT_BADGE_SETTINGS))
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
    const { result } = renderHook(() => useVisibleFacets(store, DEFAULT_BADGE_SETTINGS))
    const before = result.current
    expect(ids(before)).toEqual(['x.push'])

    // 登记面没变，变的是提供方的存储：版本号仍要 +1，消费侧才会重新读表。
    act(() => { notify?.() })
    expect(ids(result.current)).toEqual(['x.push'])
  })

  it('被设置关掉的来源不进列表；设置回来时立刻重新参与', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    registry.register(bindableFacet('x.off', { settingKey: 'showWaitingReviewInBadge' }))
    registry.register(bindableFacet('x.on'))
    const off: ResolvedBadgeSettings = { ...DEFAULT_BADGE_SETTINGS, showWaitingReviewInBadge: false }
    const { result, rerender } = renderHook(
      ({ settings }: { settings: ResolvedBadgeSettings }) => useVisibleFacets(store, settings),
      { initialProps: { settings: off } },
    )
    expect(ids(result.current)).toEqual(['x.on'])

    rerender({ settings: DEFAULT_BADGE_SETTINGS })
    // 两家都没声明 `order`，所以按注册先后：`x.off` 先登记，排在前。
    expect(ids(result.current)).toEqual(['x.off', 'x.on'])
  })

  it('登记面与设置都没变时交出同一个引用（折叠与徽标不该为此重算）', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    registry.register(bindableFacet('x.stable'))
    const { result, rerender } = renderHook(
      ({ settings }: { settings: ResolvedBadgeSettings }) => useVisibleFacets(store, settings),
      { initialProps: { settings: DEFAULT_BADGE_SETTINGS } },
    )
    const first = result.current
    rerender({ settings: DEFAULT_BADGE_SETTINGS })
    expect(result.current).toBe(first)
  })
})
