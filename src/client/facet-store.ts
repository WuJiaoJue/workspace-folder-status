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
import { registry, type AnyFacet, type FacetRegistry, type RegisteredFacet } from './facets.ts'

/** facet 自己存储的订阅句柄与它当时的快照来源。 */
interface FacetLink {
  facet: AnyFacet
  unsubscribe: () => void
}

/** {@link createFacetStore} 的产物。 */
export interface FacetStore {
  /** 订阅「快照可能变了」或「登记面变了」。 */
  subscribe(listener: () => void): () => void
  /** 单调递增的版本号；引用天然稳定，可直接作为 `useSyncExternalStore` 的快照。 */
  getVersion(): number
  /** 服务端渲染快照：与 {@link getVersion} 同型，避免 hydration 不一致。 */
  getServerVersion(): number
  /** 当前登记项（已排序）。 */
  list(): readonly RegisteredFacet[]
  /** 释放所有对 facet 存储的订阅（宿主卸载本插件时调用）。 */
  dispose(): void
}

/**
 * 创建 facet 存储。
 *
 * 对登记面做一次订阅，并在登记变化时**重新接线**各 facet 的 `subscribe`：provider 热替换
 * 实现（同 id 再注册）或运行中启用/停用插件，都只会走到这里一次，不会留下野订阅。
 *
 * @param source - 登记表面；缺省用模块级单例，测试传入自建实例以隔离。
 */
export function createFacetStore(source: FacetRegistry = registry): FacetStore {
  const listeners = new Set<() => void>()
  const links = new Map<string, FacetLink>()
  let version = 0
  let disposed = false

  /** 任一来源变化都要让消费方重新渲染，因此统一 bump。 */
  const bump = (): void => {
    if (disposed) return
    version += 1
    for (const listener of [...listeners]) {
      try {
        listener()
      } catch {
        /* 单个订阅者异常不影响其余订阅者 */
      }
    }
  }

  /** 把 links 对齐到当前登记项：新增接线、移除退订、替换重接。 */
  const rewire = (): void => {
    if (disposed) return
    const current = new Map(source.list().map((entry) => [entry.facet.id, entry.facet]))
    for (const [id, link] of [...links]) {
      if (current.get(id) === link.facet) continue
      try {
        link.unsubscribe()
      } catch {
        /* 退订失败不影响其它 facet 的接线 */
      }
      links.delete(id)
    }
    for (const [id, facet] of current) {
      if (links.has(id)) continue
      links.set(id, { facet, unsubscribe: facet.subscribe(bump) })
    }
  }

  const unsubscribeRegistry = source.subscribe(() => {
    rewire()
    bump()
  })
  rewire()

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getVersion: () => version,
    getServerVersion: () => 0,
    list: () => source.list(),
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const link of links.values()) {
        try {
          link.unsubscribe()
        } catch {
          /* 释放阶段忽略单个退订异常 */
        }
      }
      links.clear()
      unsubscribeRegistry()
      listeners.clear()
    },
  }
}

/**
 * 生产用的单例存储：消费侧（`WorkspaceBrowser`）订阅它，
 * `apply` 的 effect 结束时用 {@link disposeFacetStore} 释放全部接线。
 *
 * 单例而非每次渲染新建，是因为它持有**对每个 facet 存储的订阅**；随渲染重建会把
 * provider 的 store 拖进无谓的退订/重订，也让"快照在两个文件夹行之间读数不同"成为可能。
 */
let singleton: FacetStore | undefined

/** 取（并首次创建）单例存储。 */
export function facetStore(): FacetStore {
  if (singleton === undefined) singleton = createFacetStore()
  return singleton
}

/** 释放单例存储（插件卸载时调用；下次 {@link facetStore} 会重建）。 */
export function disposeFacetStore(): void {
  if (singleton === undefined) return
  singleton.dispose()
  singleton = undefined
}
