// @vitest-environment jsdom
/**
 * facet 协议的**消费侧全生命周期**：登记面 → `createFacetStore` → React 消费方。
 *
 * ## 为什么另开一份，而不是并入 `facets.node.test.mjs` / `use-registered-facets`
 *
 * `facets.node.test.mjs` 钉的是**登记面本身**（协议校验、来源决胜、排序、重入合并），
 * 它从不经过消费存储，也就覆盖不到「登记面变了 → store 重新接线 → React 看见」这条链。
 * `use-registered-facets.client.spec.tsx` 钉的是 hook 的 memo 依赖（迟到登记那一格），
 * 用的是最薄的一层接线。真正会坏的组合——提供方**迟到**、**热替换实现**、**注销后仍被
 * 订阅**——只有把 store 的接线与 React 的渲染放在一起跑才会暴露：`createFacetStore` 会
 * 为每个 facet 代持一份 `subscribe`，接线错了表现为「facet 注销了但推送仍在改版本号」，
 * 或者「同 id 换成新实现后消费者还在读旧快照」——这两种都不报错，只是徽标悄悄不更新。
 *
 * 每个用例都用自建 registry + 自建 store 隔离，不碰模块级单例（那会被别的用例污染）。
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createFacetStore } from '../src/client/facet-store.ts'
import { createFacetRegistry, type AnyFacet } from '../src/client/facets.ts'
import { bindableFacet } from './support/facets.ts'
import { useRegisteredFacets } from '../src/client/use-registered-facets.ts'

afterEach(cleanup)

/**
 * 消费者替身：把 hook 交回的登记面按 id + 折果画出来。
 *
 * 折果现算（与 `WorkspaceBrowser` 一致：`fold(facet.getSnapshot(), ids, now)`），这样
 * 「版本号变了、但快照读的还是旧的」这类错会显示成文案没跟上，而不是只断言数组长度。
 */
function Probe({ store }: { store: ReturnType<typeof createFacetStore> }): ReactNode {
  const facets = useRegisteredFacets(store)
  return (
    <ul>
      {facets.map(({ facet }) => {
        const fold = facet.fold(facet.getSnapshot(), ['session-a'], 0)
        return <li key={facet.id} data-testid="facet">{`${facet.id}#${String(fold.count)}`}</li>
      })}
    </ul>
  )
}

const shown = (): string[] => screen.queryAllByTestId('facet').map(node => node.textContent ?? '')

/** 一个外部存储面可控的 facet：改 `value` 再 `notify()` 就是「提供方换快照」。 */
function controllable(id: string, value = 1): { facet: AnyFacet; set: (next: number) => void; notify: () => void } {
  let current = value
  let listener: (() => void) | undefined
  const facet = bindableFacet(id, {
    subscribe: (next: () => void) => {
      listener = next
      return () => { listener = undefined }
    },
    getSnapshot: () => current,
    fold: (snapshot: unknown) => ({ count: Number(snapshot), tone: 'warn', pulse: false }),
  })
  return {
    facet,
    set: (next) => { current = next },
    notify: () => { listener?.() },
  }
}

describe('facet 生命周期：登记面 → 消费存储 → React', () => {
  it('首渲染时表为空，提供方渲染后才登记 —— 消费者下一轮就看见它', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    render(<Probe store={store} />)
    // 起点：宿主不保证 `apply` 与本组件首渲染的先后，这里就是「提供方还没登记」。
    expect(shown()).toEqual([])

    // 回归点：旧接线下（订阅只重渲染、memo 依赖里没有版本号）这一步之后界面纹丝不动。
    act(() => {
      registry.register(controllable('x.late', 3).facet)
    })
    expect(shown()).toEqual(['x.late#3'])
  })

  it('facet 自己的存储变更到达消费者（登记面没变，store 代持的订阅必须还在）', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    const provider = controllable('x.push', 2)
    registry.register(provider.facet)
    render(<Probe store={store} />)
    expect(shown()).toEqual(['x.push#2'])

    act(() => {
      provider.set(9)
      provider.notify()
    })
    expect(shown()).toEqual(['x.push#9'])
  })

  it('同 id 热替换：消费者读到新实现的快照，旧实现的推送不再改版本号', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    const previous = controllable('x.swap', 1)
    registry.register(previous.facet)
    render(<Probe store={store} />)
    expect(shown()).toEqual(['x.swap#1'])

    const replacement = controllable('x.swap', 4)
    act(() => {
      registry.register(replacement.facet)
    })
    expect(shown()).toEqual(['x.swap#4'])

    // 旧实现的退订必须真的发生：否则它的推送仍会让每个组件白重渲染。
    const version = store.getVersion()
    act(() => { previous.notify() })
    expect(store.getVersion()).toBe(version)
  })

  it('注销后消费者立刻丢掉它，且不再订阅它的存储', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    const gone = controllable('x.gone', 5)
    const release = vi.fn()
    registry.register({
      ...gone.facet,
      subscribe: () => release,
    })
    render(<Probe store={store} />)
    expect(shown()).toEqual(['x.gone#5'])

    act(() => { registry.remove('x.gone') })
    expect(shown()).toEqual([])
    // store 在注销时退订：`subscribe` 交回的退订函数必须被调用过一次。
    expect(release).toHaveBeenCalledOnce()
  })

  it('dispose 释放全部接线：之后登记新来源既不抛错也不改版本号', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    const provider = controllable('x.owned', 1)
    // 包一层而不是替掉 `subscribe`：既保住「推送确实到达 store」的前置事实，又能观察
    // store 是否把提供方那份订阅交还了。
    const release = vi.fn()
    registry.register({
      ...provider.facet,
      subscribe: (listener: () => void) => {
        const unsubscribe = provider.facet.subscribe(listener)
        return () => { unsubscribe(); release() }
      },
    })
    render(<Probe store={store} />)
    expect(shown()).toEqual(['x.owned#1'])

    // 前置：dispose 之前这条推送真的能进 store（否则后面的断言只是空转）。
    const before = store.getVersion()
    act(() => { provider.set(2); provider.notify() })
    expect(shown()).toEqual(['x.owned#2'])
    expect(store.getVersion()).toBe(before + 1)

    act(() => { store.dispose() })
    // 卸下本插件的 effect 时，提供方那份订阅必须被交还：否则它的推送会打进一个
    // 已经没人读的 store，provider 侧永远看不到自己的订阅者被释放。
    expect(release).toHaveBeenCalledOnce()
    // 卸载路径：登记面还能变（别的插件仍在注册），但已释放的 store 不该再碰任何订阅者。
    act(() => { registry.register(controllable('x.after', 1).facet) })
    expect(store.getVersion()).toBe(before + 1)
    // 提供方在 dispose 之后推送也不该进来（它的退订已在 dispose 时调用）。
    act(() => { provider.notify() })
    expect(store.getVersion()).toBe(before + 1)
  })
})
