/**
 * Fork-owned coverage for the **facet protocol**: the registration surface, the
 * generic fold/merge contract, and the two transitional adapters.
 *
 * 为什么单独一份而不是塞进 `group-status.client.spec.ts`：协议是本插件对外的**契约**，
 * 它的行为（拒绝什么、谁覆盖谁、注销语义）与聚合算法是两件事。契约测试跑的是
 * `createFacetRegistry()` 建的隔离登记面，绝不碰模块级单例，否则用例会互相污染。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

const {
  GROUP_STATUS_FACET_PROTOCOL_VERSION,
  FACET_TONE_RANK,
  createFacetRegistry,
  defaultMergeFold,
  facetOrigin,
  facetRejection,
} = await import('../lib/types/client/facets.js')

/** 造一个最小合法 facet；`overrides` 用来测各条校验规则。 */
const facet = (id, overrides = {}) => ({
  protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION,
  id,
  subscribe: () => () => undefined,
  getSnapshot: () => undefined,
  fold: () => ({ count: 1, tone: 'warn', pulse: false }),
  ...overrides,
})

test('协议版本是 1，且 facetRejection 认它', () => {
  assert.equal(GROUP_STATUS_FACET_PROTOCOL_VERSION, 1)
  assert.equal(facetRejection(facet('a.b')), undefined)
})

test('拒绝形状不合格的来源，并给出可诊断的原因', () => {
  assert.equal(facetRejection(undefined), 'not-an-object')
  assert.equal(facetRejection('nope'), 'not-an-object')
  assert.equal(facetRejection({ ...facet('a.b'), protocol: 2 }), 'protocol-mismatch')
  assert.equal(facetRejection({ ...facet('a.b'), protocol: undefined }), 'protocol-mismatch')
  assert.equal(facetRejection({ ...facet('a.b'), id: '' }), 'missing-id')
  assert.equal(facetRejection({ ...facet('a.b'), id: 42 }), 'missing-id')
  assert.equal(facetRejection({ ...facet('a.b'), fold: undefined }), 'missing-methods')
  assert.equal(facetRejection({ ...facet('a.b'), subscribe: undefined }), 'missing-methods')
  assert.equal(facetRejection({ ...facet('a.b'), getSnapshot: 1 }), 'missing-methods')
})

test('来源缺省按 provider，显式 legacy 才算代管', () => {
  assert.equal(facetOrigin({}), 'provider')
  assert.equal(facetOrigin({ origin: 'legacy' }), 'legacy')
  // 拼错的 origin 不会被当成"更高"，按最保守的 provider 处理。
  assert.equal(facetOrigin({ origin: 'whatever' }), 'provider')
})

test('同 id 由来源决胜，与注册顺序无关', () => {
  const registry = createFacetRegistry()
  const provider = facet('x.review')
  const legacy = facet('x.review', { origin: 'legacy' })

  // legacy 先来：provider 覆盖它。
  assert.deepEqual(registry.register(legacy), { ok: true, id: 'x.review' })
  assert.deepEqual(registry.register(provider), { ok: true, id: 'x.review' })
  assert.equal(registry.list().length, 1)
  assert.equal(registry.list()[0].facet, provider)

  // 反过来：provider 在前时，legacy 的登记被拒。
  const other = createFacetRegistry()
  other.register(provider)
  assert.deepEqual(other.register(legacy), { ok: false, id: 'x.review', reason: 'superseded' })
  assert.equal(other.list()[0].facet, provider, '被拒的登记不得覆盖已在位的所有者')
})

test('同来源重复登记覆盖前一份，provider 热替换不必先注销', () => {
  const registry = createFacetRegistry()
  const first = facet('x.a')
  const second = facet('x.a')
  registry.register(first)
  registry.register(second)
  assert.equal(registry.list().length, 1)
  assert.equal(registry.list()[0].facet, second)
})

test('注销只摘"还是自己"的那一份', () => {
  const registry = createFacetRegistry()
  const provider = facet('x.a')
  const legacy = facet('x.a', { origin: 'legacy' })
  registry.register(provider)
  registry.register(legacy)

  // 旧代管者的 dispose 不该把已在位的所有者摘掉。
  assert.equal(registry.remove('x.a', legacy), false)
  assert.equal(registry.list().length, 1)
  assert.equal(registry.remove('x.a', provider), true)
  assert.equal(registry.list().length, 0)
  assert.equal(registry.remove('x.a'), false, '摘不存在的东西返回 false 而不是抛')
})

test('登记面按 order 再按注册先后排序，且每次变化都通知', () => {
  const registry = createFacetRegistry()
  let notified = 0
  const unsubscribe = registry.subscribe(() => { notified += 1 })
  registry.register(facet('b', { order: 20 }))
  registry.register(facet('a', { order: 10 }))
  assert.equal(notified, 2, '每次登记都通知一次')
  registry.register(facet('z'))
  registry.register(facet('y'))
  // 未声明 order 的排在最后，彼此保持注册先后。
  assert.deepEqual(registry.list().map(entry => entry.facet.id), ['a', 'b', 'z', 'y'])
  // 后注册但声明了 order 的来源仍插到未声明者之前：排序位不是先到先得。
  registry.register(facet('w', { order: 5 }))
  assert.deepEqual(registry.list().map(entry => entry.facet.id), ['w', 'a', 'b', 'z', 'y'])
  assert.equal(notified, 5)
  unsubscribe()
  registry.register(facet('e'))
  assert.equal(notified, 5, '退订后不再打扰')
})

test('重入的登记被合并成补跑一轮，而不是递归或漏通知', () => {
  const registry = createFacetRegistry()
  const seen = []
  let depth = 0
  let maxDepth = 0
  // 订阅者①：看到登记面里出现 'kicker' 就把它摘掉（一次真实的"到了就转成别的来源"）。
  const off1 = registry.subscribe(() => {
    depth += 1
    maxDepth = Math.max(maxDepth, depth)
    try {
      if (registry.list().some(entry => entry.facet.id === 'kicker')) {
        registry.remove('kicker')
        seen.push('removed')
      }
    } finally {
      depth -= 1
    }
  })
  const off2 = registry.subscribe(() => { seen.push('second') })
  registry.register(facet('kicker'))
  assert.ok(maxDepth <= 1, `通知不得嵌套递归（实测最大深度 ${maxDepth}）`)
  assert.ok(seen.includes('removed'), '订阅者的注销应生效')
  assert.ok(seen.filter(word => word === 'second').length >= 2, '后到的订阅者每一轮都该看到')
  const before = seen.length
  registry.register(facet('other'))
  assert.ok(seen.length > before, '之后的登记仍然通知')
  off1(); off2()
})

test('缺省合并：数量相加、色档取更紧急、脉冲取或，且从不带 data', () => {
  assert.deepEqual(
    defaultMergeFold(
      { count: 1, tone: 'info', pulse: false },
      { count: 2, tone: 'error', pulse: true },
    ),
    { count: 3, tone: 'error', pulse: true },
  )
  assert.equal(defaultMergeFold({ count: 1, tone: 'warn', pulse: false }, { count: 1, tone: 'info', pulse: false }).tone, 'warn')
  assert.equal('data' in defaultMergeFold(
    { count: 1, tone: 'info', pulse: false, data: { any: 1 } },
    { count: 1, tone: 'info', pulse: false, data: { any: 2 } },
  ), false, '缺省合并器不该编造一个它看不懂的 data 合并结果')
})

// #25③：色档优先级此前有两条实现（对外的 `FACET_TONE_RANK` 零使用 + 私有的
// `TONE_ORDER` 真正生效）。现已统一到前者。下面两条是这次的回归护栏。
test('#25③：合并用的就是对外导出的那张表，不再另持一份', () => {
  // 断言**由表本身推出**，不写死 info<warn<error：有人改了 FACET_TONE_RANK，这条会跟着
  // 动；而若有人重新引入第二份表，两边就会在这里对不上。
  const tones = Object.keys(FACET_TONE_RANK)
  assert.ok(tones.length > 1, '表里得有可比较的档位')
  for (const a of tones) {
    for (const b of tones) {
      const want = FACET_TONE_RANK[b] > FACET_TONE_RANK[a] ? b : a
      assert.equal(
        defaultMergeFold({ count: 1, tone: a, pulse: false }, { count: 1, tone: b, pulse: false }).tone,
        want,
        `${a} + ${b} 应取 ${want}（按 FACET_TONE_RANK）`,
      )
    }
  }
})

test('#25③：坏 provider 交出非法色档时，合法那一档仍必胜，非法值不被传播', () => {
  // `facetRejection` 不校验 fold() 返回的 tone（那是跨插件边界，运行时才产出），所以
  // 非法档位真能到达 defaultMergeFold。旧实现靠 indexOf 返回 -1 得到这个性质；统一到
  // FACET_TONE_RANK 后由 `?? -1` 保住。删掉那个 `?? -1`，第一条断言会红。
  const BOGUS = 'not-a-tone'
  assert.equal(
    defaultMergeFold({ count: 1, tone: BOGUS, pulse: false }, { count: 1, tone: 'error', pulse: false }).tone,
    'error',
    '左侧非法时，右侧合法档必须胜',
  )
  assert.equal(
    defaultMergeFold({ count: 1, tone: 'error', pulse: false }, { count: 1, tone: BOGUS, pulse: false }).tone,
    'error',
    '右侧非法时，左侧合法档必须胜',
  )
  // 两边都非法：与统一前一致，保留左侧，不把 undefined 之类造出来。
  assert.equal(
    defaultMergeFold({ count: 1, tone: BOGUS, pulse: false }, { count: 1, tone: 'other-bogus', pulse: false }).tone,
    BOGUS,
  )
})
