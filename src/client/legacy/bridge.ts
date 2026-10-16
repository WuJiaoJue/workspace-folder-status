/**
 * 过渡期的跨插件桥：把 dsh-later / dsh-gitea-dispatch 的摘要面接到 facet 登记面上。
 *
 * ⚠️ 本目录整体是**临时代管**。两个提供方按 `../facets.ts` 的协议自己注册之后
 * （对应它们各自的 issue），`legacy/` 整个目录与 `package.json` 里的
 * `dsh.client.external` 两条声明一并删除，本插件不再认识任何具体状态源。
 *
 * ## 为什么在这里、又为什么要"登记表"
 *
 * 两家的 store 都在自己的 client `apply` 里创建，而**插件 apply 的先后宿主不保证**：
 * 本插件可能在对方 store 就绪之前就开始渲染。所以桥接层不能一次性抓 store，必须
 * 订阅对方的"store 登记变化"，并把 store 的迟到本身当作一次快照变化通知出去
 * （`subscribe` 里同时挂两层）。这与 `cross-plugin-summary.ts` 里 `createSummaryRegistry`
 * 解决的是一模一样的问题，只是这次藏在桥接层里，不污染协议。
 *
 * ## 为什么用 subscribe/getSnapshot 而不是调对方的 hook
 *
 * 见 `../facets.ts` 文件头：hook 数量必须逐次渲染恒定，而 facet 运行时可增删。桥接层
 * 只要把对方的 store 面交出去，聚合侧就完全不需要知道背后有几个来源。
 *
 * @module dsh-group-status/client/legacy/bridge
 */
import { registry, type FacetRegistry, type Unregister } from '../facets.ts'
import { assembleLegacySources, type LegacyProviderClients } from './store-source.ts'
import { registerLegacyFacets } from './register-legacy-facets.tsx'

declare const require: (id: string) => unknown

/**
 * 读一个 provider 的 client 模块表行。
 *
 * 用**注入的** `require`（闭包工厂的参数）而不是 `globalThis.require`：宿主没有全局
 * require（实测 `typeof globalThis.require === 'undefined'`），走全局会静默拿到
 * undefined，于是整个跨插件集成"看起来装着、其实一直没工作"。
 * 提供方未安装 / 未启用时模块表里没有这一行，`require` 抛错 → 当作缺席。
 */
function clientOf<T>(specifier: string): T | undefined {
  try {
    return require(specifier) as T | undefined
  } catch {
    return undefined
  }
}

/**
 * 安装过渡适配器。
 *
 * @param target - 登记面；缺省用生产单例，测试传入自建实例以隔离。
 */
export function installLegacyBridges(target: FacetRegistry = registry): Unregister {
  const later = clientOf<LegacyProviderClients['later']>('dsh-later/client')
  const dispatch = clientOf<LegacyProviderClients['dispatch']>('dsh-gitea-dispatch/client')
  // 缺席就省略键（exactOptionalPropertyTypes 下 undefined 不是"没有"的合法写法）。
  const clients: LegacyProviderClients = {
    ...(later === undefined ? {} : { later }),
    ...(dispatch === undefined ? {} : { dispatch }),
  }
  const sources = assembleLegacySources(clients)
  return registerLegacyFacets(sources, target)
}
