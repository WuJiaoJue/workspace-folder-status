/**
 * `session-actions/derived.ts`：把宿主 observable 投影成另一个 observable。
 *
 * 为什么单开一份：这个投影器的唯一职责就是**身份稳定**——消费者（每行一次的 `Set`
 * 查找）靠 `Object.is` 判等，投影每读一次就新建对象等于让选择器永不收敛。而上游那份
 * 行操作 spec 在本仓库跑不起来（`vitest.config.ts` 的 MONOREPO_ONLY_SPECS），所以
 * 这条契约此前只活在注释里。
 */
import { describe, expect, it, vi } from 'vitest'
import { derive } from '../src/client/session-actions/derived.ts'

/** 可手动推进的源 observable：`push` 换快照并通知，`reads` 记录被读了几次。 */
function source<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    observable: {
      getSnapshot: () => snapshot,
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    push(next: T): void {
      snapshot = next
      for (const listener of listeners) listener()
    },
    get listenerCount(): number { return listeners.size },
  }
}

describe('derive', () => {
  it('投影返回 undefined 也只算一次，而不是每次读都重算', () => {
    // 这正是 #23 修掉的坑：用 `undefined` 兼任"未计算"，一个**合法**的空投影结果会让
    // 每次 getSnapshot 都重跑 project；若 project 里新建 Set，消费者永远拿不到同一引用。
    const src = source('snapshot')
    const project = vi.fn((value: string) => (value === 'snapshot' ? undefined : value))
    const derived = derive(src.observable, project)

    expect(derived.getSnapshot()).toBeUndefined()
    expect(derived.getSnapshot()).toBeUndefined()
    expect(project).toHaveBeenCalledTimes(1)
  })

  it('源快照换引用才重算，且投影结果按引用稳定', () => {
    const src = source({ ids: ['a', 'b'] })
    const project = vi.fn((value: { ids: string[] }) => new Set(value.ids))
    const derived = derive(src.observable, project)

    const first = derived.getSnapshot()
    expect(derived.getSnapshot()).toBe(first)
    expect(project).toHaveBeenCalledTimes(1)

    src.push({ ids: ['a', 'b', 'c'] })
    const second = derived.getSnapshot()
    expect(second).not.toBe(first)
    expect([...second]).toEqual(['a', 'b', 'c'])
    expect(project).toHaveBeenCalledTimes(2)
  })

  it('订阅与退订透传给源，不额外持有监听者', () => {
    const src = source(1)
    const derived = derive(src.observable, value => value + 1)
    const listener = vi.fn()

    const off = derived.subscribe(listener)
    expect(src.listenerCount).toBe(1)
    src.push(2)
    expect(listener).toHaveBeenCalledTimes(1)

    off()
    expect(src.listenerCount).toBe(0)
  })
})
