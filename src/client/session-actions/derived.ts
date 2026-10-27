/** Derived observable sources for the row actions' injected hooks. */
import type { HostObservable } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * "还没投影过"的标记。
 *
 * 不能用 `undefined` 兼任：投影**合法地**可能返回 `undefined`（"当前没有待处理的
 * 请求"就是一次正常的空结果），把它当成"未计算"会让每次读都重跑一次 `project`。
 * 投影若新建 `Set` / 数组，消费者每次读都拿到新引用，选择器于是永远不收敛——这正是
 * 本函数要避免的那件事。Symbol 不与任何投影结果相等，且只在本模块内存在。
 */
const NOT_PROJECTED = Symbol('derive.notProjected')

/**
 * Project one observable into another, recomputing only when the source
 * snapshot changes identity, so consumers that select from the projection
 * (a Set lookup per row) never rebuild it per read.
 * @param source - the observable to project.
 * @param project - pure projection of one source snapshot.
 * @returns the projected observable, subscribing through the source.
 */
export function derive<S, T>(source: HostObservable<S>, project: (snapshot: S) => T): HostObservable<T> {
  let seen: S | undefined
  let value: T | typeof NOT_PROJECTED = NOT_PROJECTED
  return {
    getSnapshot: () => {
      const snapshot = source.getSnapshot()
      if (value === NOT_PROJECTED || snapshot !== seen) {
        seen = snapshot
        value = project(snapshot)
      }
      // 上面的分支保证走到这里 `value` 已是一次投影的结果；`project` 拿不到
      // `NOT_PROJECTED`（模块私有 Symbol），所以这个断言不会掩盖"未计算"。
      return value as T
    },
    subscribe: listener => source.subscribe(listener),
  }
}
