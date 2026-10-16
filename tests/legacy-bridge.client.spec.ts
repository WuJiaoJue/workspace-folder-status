/**
 * 过渡期桥接层的覆盖：设置过滤与「store 迟到」。
 *
 * 这两件事都在 `legacy/` 里，也恰好是协议落地时最容易翻车的两处：
 *
 * 1. **过滤必须在折叠之前**。放在渲染阶段会出现「label 里有、计数里没有」；放在聚合
 *    之前则四处天然同源。
 * 2. **插件 apply 的先后宿主不保证**：本插件可能在提供方的 store 就绪之前就开始渲染。
 *    桥接层必须把「store 迟到」本身当作一次变化通知出去，否则徽标要等到下一次轮询
 *    才出现（而且没有任何报错）。
 */
import { describe, expect, it, vi } from 'vitest'
import { assembleLegacySources, bridgeLateStoreSource, visibleFacets } from '../src/client/legacy/store-source.ts'
import { createScheduleFacet, type ScheduleSummaryMap } from '../src/client/legacy/schedule.ts'
import { directStatusesForGroups } from '../src/client/group-status.ts'
import { createWaitingReviewFacet, type WaitingReviewSummaryMap } from '../src/client/legacy/waiting-review.ts'
import { createFacetRegistry, type AnyFacet } from '../src/client/facets.ts'
import { createFacetStore } from '../src/client/facet-store.ts'

import { DEFAULT_BADGE_SETTINGS } from '../src/client/badge-settings.ts'
import { bindableFacet, registeredFacet } from './support/facets.ts'

const OFF = { ...DEFAULT_BADGE_SETTINGS, showWaitingReviewInBadge: false }



describe('visibleFacets', () => {
  const waiting = createWaitingReviewFacet({ subscribe: () => () => undefined, getSnapshot: () => undefined })
  const schedule = createScheduleFacet({ subscribe: () => () => undefined, getSnapshot: () => undefined })
  const noKey = registeredFacet(bindableFacet('x.plain'))

  it('按 facet.settingKey 筛掉关掉的来源，没声明键的始终参与', () => {
    const all = [registeredFacet(schedule as AnyFacet), registeredFacet(waiting as AnyFacet), noKey]
    // 两个适配器都声明了 order（10 / 20），无 order 的 x.plain 按规则排在最后。
    expect(visibleFacets(all, DEFAULT_BADGE_SETTINGS).map(e => e.facet.id))
      .toEqual(['dsh-later.schedule', 'dsh-gitea-dispatch.waiting-review', 'x.plain'])
    // 关掉等待评审后，剩下的相对顺序不变（过滤不打乱登记顺序）。
    expect(visibleFacets(all, OFF).map(e => e.facet.id))
      .toEqual(['dsh-later.schedule', 'x.plain'])
  })

  it('settingKey 拼错时按"显示"处理，而不是让一个状态整块消失', () => {
    const typo = registeredFacet(bindableFacet('x.typo', { settingKey: 'showNonexistent' }))
    expect(visibleFacets([typo], OFF).length).toBe(1)
  })
})

describe('store 迟到的桥接', () => {
  /**
   * 复刻提供方那份「store 在 apply 里才创建」的形状：先建桥，再补 store。
   * 桥接层的实现在 `bridge.ts` 内部，这里通过同样的两步时序验证对外可见的行为。
   */
  const lateStore = <Snapshot>() => {
    let store: { getSnapshot: () => Snapshot; subscribe: (l: () => void) => () => void } | undefined
    let latest = new Map() as Snapshot
    const registryListeners = new Set<() => void>()
    let storeListeners = new Set<() => void>()
    return {
      getStore: () => store,
      subscribeRegistry: (listener: () => void) => {
        registryListeners.add(listener)
        return () => {
          registryListeners.delete(listener)
        }
      },
      setStore: (snapshot: Snapshot) => {
        latest = snapshot
        // 新建一个 store 对象 = 提供方重新 apply 了一次。旧对象的通知通道要能整体废弃，
        // 所以 listeners 也跟着换一套。
        storeListeners = new Set()
        store = {
          getSnapshot: () => latest,
          subscribe: (listener: () => void) => {
            storeListeners.add(listener)
            return () => {
              storeListeners.delete(listener)
            }
          },
        }
        for (const listener of [...registryListeners]) listener()
      },
      /** 同一个 store 推新快照（提供方的常态）：对象身份不变，只通知。 */
      push: (snapshot: Snapshot) => {
        // 同一个 store 对象推新快照（提供方的常态）：只通知，不换身份。
        latest = snapshot
        for (const listener of [...storeListeners]) listener()
      },
    }
  }

  it('store 到位即算一次变化，并且读得到它的快照', () => {
    const host = lateStore<WaitingReviewSummaryMap>()
    const source = bridgeLateStoreSource<WaitingReviewSummaryMap>(host.getStore, host.subscribeRegistry)!
    const seen = vi.fn()
    const unsubscribe = source.subscribe(seen)
    // store 还没来：读不到快照，但也不报错（徽标就当这个来源此刻没有贡献）。
    expect(source.getSnapshot()).toBeUndefined()
    expect(seen).not.toHaveBeenCalled()
    // store 迟到必须算一次变化，否则徽标要等到下一次轮询才出现，且毫无报错线索。
    host.setStore(new Map([['a', { prNumber: 1, state: 'waiting' }]]))
    expect(seen).toHaveBeenCalledTimes(1)
    expect(source.getSnapshot()?.size).toBe(1)
    unsubscribe()
  })

  it('换掉 store 后只剩一条通知链路（不重复计数）', () => {
    const host = lateStore<WaitingReviewSummaryMap>()
    const source = bridgeLateStoreSource<WaitingReviewSummaryMap>(host.getStore, host.subscribeRegistry)!
    const seen = vi.fn()
    source.subscribe(seen)

    host.setStore(new Map([['a', { prNumber: 1, state: 'waiting' }]]))
    expect(seen).toHaveBeenCalledTimes(1)
    // 同一个 store 推新快照：一次通知。
    host.push(new Map([['b', { prNumber: 2, state: 'waiting' }]]))
    expect(seen).toHaveBeenCalledTimes(2)
    expect(source.getSnapshot()?.has('b')).toBe(true)

    // 提供方重新 apply（换了 store 对象）：仍然只有一条链路在响 —— 旧 store 的
    // 订阅若没退订，此后每次 push 都会变成两次通知，徽标就跟着白重渲染一轮。
    host.setStore(new Map([['c', { prNumber: 3, state: 'waiting' }]]))
    expect(seen).toHaveBeenCalledTimes(3)
    host.push(new Map([['d', { prNumber: 4, state: 'waiting' }]]))
    expect(seen).toHaveBeenCalledTimes(4)
    expect(source.getSnapshot()?.has('d')).toBe(true)
  })

  it('提供方缺席时拼不出任何入参，因此不产生登记', () => {
    // 桥接层对"这一路根本没有"的表示就是两个 undefined；图标层据此跳过登记。
    expect(assembleLegacySources({})).toEqual({ schedule: undefined, waiting: undefined })
    // 只有一家在时，另一家仍为 undefined（半边坏不影响半边）。
    const one = new Map([['a', { prNumber: 1, state: 'waiting' as const }]])
    const assembled = assembleLegacySources({ dispatch: { getWaitingSummaryStore: () => ({ getSnapshot: () => one, subscribe: () => () => undefined }) } })
    expect(assembled.schedule).toBeUndefined()
    expect(assembled.waiting?.getSnapshot()?.size).toBe(1)
  })

  it('提供方导出了聚合函数时，桥接层把它一起交给适配器', () => {
    const summarize = () => ({ sessions: 1, prNumbers: [3], state: 'waiting' as const })
    const store = () => ({ getSnapshot: () => undefined, subscribe: () => () => undefined })
    const assembled = assembleLegacySources({ dispatch: { getWaitingSummaryStore: store, subscribeWaitingSummaryStore: () => () => undefined, summarizeWaitingGroup: summarize as never } })
    expect(assembled.waiting?.summarize).toBe(summarize as never)
    // 没导出聚合函数的旧版本：不塞一个 undefined 键进去，适配器据此走本地折叠。
    const older = assembleLegacySources({ dispatch: { getWaitingSummaryStore: store } })
    expect('summarize' in (older.waiting ?? {})).toBe(false)
  })
})

describe('facet store 的订阅接线', () => {
  it('facet 自己的 store 通知会 bump 版本；登记面变化也会', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    let notify: (() => void) | undefined
    const facetA = bindableFacet('x.a', {
      subscribe: (listener: () => void) => {
        notify = listener
        return () => {
          notify = undefined
        }
      },
    })
    registry.register(facetA)
    const before = store.getVersion()
    const listener = vi.fn()
    store.subscribe(listener)
    notify?.()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(store.getVersion()).toBe(before + 1)

    // 注销后 provider 的残留通知不该再来（订阅已解除），但登记面变化仍然可见。
    registry.remove('x.a')
    const afterRemove = store.getVersion()
    expect(afterRemove).toBeGreaterThan(before)
    expect(notify).toBeUndefined()
    store.dispose()
  })

  it('重入的登记不会把订阅接线搞乱', () => {
    const registry = createFacetRegistry()
    const store = createFacetStore(registry)
    // 订阅者在收到第一次通知时补登记一个派生来源：rewire 必须在补跑那一轮里跟上。
    registry.register(bindableFacet('x.first', {
      subscribe: (listener: () => void) => {
        listener()
        return () => undefined
      },
    }))
    let wired = 0
    store.subscribe(() => { wired += 1 })
    registry.register(bindableFacet('x.second'))
    expect(store.list().map(entry => entry.facet.id)).toEqual(['x.first', 'x.second'])
    expect(wired).toBeGreaterThan(0)
    store.dispose()
  })

  it('schedule 快照为空表时该来源不进折果表', () => {
    const empty: ScheduleSummaryMap = new Map()
    const facet = createScheduleFacet({ subscribe: () => () => undefined, getSnapshot: () => empty })
    const groups = [{ key: 'g', sessions: [] }]
    expect(directStatusesForGroups(groups, [registeredFacet(facet as AnyFacet)]).get('g')?.facets.size).toBe(0)
  })
})
