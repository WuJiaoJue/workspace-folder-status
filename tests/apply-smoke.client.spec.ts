// @vitest-environment jsdom
/**
 * 宿主半边的最小冒烟：`apply(ctx, config)` 跑一遍、能打出自报 banner。
 *
 * ## 为什么需要它
 *
 * 上游那份完整的 `tests/apply.client.spec.ts` 在 `vitest.config.ts` 的
 * `MONOREPO_ONLY_SPECS` 里——它要宿主应用整条依赖闭包（published client bundle 的
 * externals），在本仓库永远不跑。于是 `src/index.ts` 这个**每个宿主进程都会执行的**
 * 入口，此前没有任何本地用例覆盖：`apply` 里多一行会抛错的代码，或 banner 被改坏，
 * 本地全绿、装机才炸。
 *
 * 这里刻意只钉两件事，不复制上游那份 spec：
 *   1. 这个插件没有宿主行为（`apply` 不得读 `ctx`）——它靠纯 UI 的形态存在；
 *   2. banner 仍然报得出「哪个产物、哪个进程」，这是宿主日志里唯一的自报信号
 *      （见 `src/build-stamp.ts` 的文件头）。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply } from '../src/index.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 配置面照抄 `Config` 的默认值；本插件的 `apply` 不读它，形状对即可。 */
const config = {
  showCompletedInBadge: true,
  showRunningInBadge: true,
  showPendingInBadge: true,
  showHoverDetails: true,
  countThreshold: 2,
}

describe('apply（宿主半边）', () => {
  it('不触碰 host ctx、不抛错，并打出带产物 mtime 与 pid 的 banner', () => {
    // 一旦 `apply` 开始读宿主上下文（哪怕只是 `ctx.on(...)`），这条就会炸：
    // 纯 UI 插件一旦偷偷有了宿主行为，卸载顺序/热重载语义就全变了。
    const untouched = new Proxy({}, {
      get() { throw new Error('apply 不得读取 host ctx') },
    })
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    expect(() => { apply(untouched, config) }).not.toThrow()

    expect(log).toHaveBeenCalledTimes(1)
    const banner = log.mock.calls[0]?.[0] as string
    expect(banner).toMatch(/^\[dsh-group-status] apply called; artifact mtime=\S+ pid=\d+$/)
    expect(banner).toContain(`pid=${String(process.pid)}`)
    // `artifactTime` 读不到自己的文件时返回 'unreadable'；那是"日志里查不出构建"的
    // 故障态，冒烟必须把它和正常的时间戳区分开。
    expect(banner).not.toContain('mtime=unreadable')
  })
})
