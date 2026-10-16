/**
 * 测试用的最小合法 facet 工厂。
 *
 * 放在 `tests/support/` 而不是各 spec 里复制：协议校验改一个字段时，所有用例要一起红，
 * 不该只红一份副本。
 */
import { GROUP_STATUS_FACET_PROTOCOL_VERSION, type AnyFacet } from '../../src/client/facets.ts'
import type { RegisteredFacet } from '../../src/client/facets.ts'

/** 一个只满足协议必填面的 facet；`extra` 用来覆盖单项。 */
export function bindableFacet(id: string, extra: Partial<AnyFacet> = {}): AnyFacet {
  return {
    protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION,
    id,
    subscribe: () => () => undefined,
    getSnapshot: () => undefined,
    fold: () => ({ count: 1, tone: 'warn', pulse: false }),
    ...extra,
  } as AnyFacet
}

/** 包成登记项（`sequence` 只在缺 `order` 时参与排序，测试里固定即可）。 */
export const registeredFacet = (facet: AnyFacet, sequence = 0): RegisteredFacet => ({ facet, sequence })
