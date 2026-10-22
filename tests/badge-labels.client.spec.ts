/**
 * Fork-owned coverage for the badge **wording**, driven through the facet protocol.
 *
 * 这一份同时是「协议可渲染性」的证明：一个陌生来源只要交出 `fold / label / pulse`
 * （图标可选），徽标就能把它读成人话，本插件不需要为它写任何一行分支。历史教训就在
 * 这里：文案曾经为每个状态源各写一遍，于是提供方新增字段时本插件一无所知、信息静默
 * 丢失（CHANGELOG 0.2.3 第一条）。
 *
 * 单独成文而不是塞进 `rows/GroupBadge.tsx` 的用例：那个模块引宿主图标集，其
 * `require` 图在本仓库解析不了（`vitest.config.ts` 排除理由 (b)）。
 */
import { describe, expect, it } from 'vitest'
import { zh } from '../src/client/locales.ts'
import {
  facetCountTotal, facetLines, facetPulseClass, groupLiveLabel, hoverStatusLines,
} from '../src/client/badge-labels.ts'
import { EMPTY_LIVE_STATUS, type FacetEntry, type GroupLiveStatus } from '../src/client/group-status.ts'
import { GROUP_STATUS_FACET_PROTOCOL_VERSION, type AnyFacet, type AnyFacetFold } from '../src/client/facets.ts'

/** 真字典 + 宿主同款插值，保证测的是实际会显示的句子。 */
const t = ((key: string, options?: Record<string, string | number>): string => {
  const template = zh[key as keyof typeof zh]
  if (template === undefined) return key
  if (options === undefined) return template
  return template.replace(/\{(\w+)\}/g, (all, name: string) => String(options[name] ?? all))
}) as never

/** 本插件自己的档位全开；外部来源没有档位可开（登记即显示）。 */
const ALL_ON = {
  showPendingInBadge: true, showRunningInBadge: true, showCompletedInBadge: true,
  showHoverDetails: true, countThreshold: 2,
} as const

const NOW = 1_000_000

const status = (overrides: Partial<GroupLiveStatus> = {}): GroupLiveStatus => ({
  ...EMPTY_LIVE_STATUS, ...overrides,
})

/** 一个最小来源：只交协议要求的三样。 */
const facet = (id: string, fold: AnyFacetFold, extra: Partial<AnyFacet> = {}): FacetEntry => ({
  facet: {
    protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION, id,
    subscribe: () => () => undefined,
    getSnapshot: () => undefined,
    fold: () => fold,
    ...extra,
  } as AnyFacet,
  fold,
})

const table = (...entries: FacetEntry[]): ReadonlyMap<string, FacetEntry> =>
  new Map(entries.map(entry => [entry.facet.id, entry]))

describe('陌生来源不写任何分支也能被读出来', () => {
  it('有 label 时用来源自己的句子', () => {
    const s = status({ facets: table(facet('x.a', { count: 2, tone: 'warn', pulse: false }, {
      label: fold => `${fold.count} 个陌生状态`,
    })) })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('2 个陌生状态')
    expect(facetLines(s, t, NOW)).toEqual(['2 个陌生状态'])
  })

  it('没 label 时退回通用措辞，而不是把内部 id 念给用户', () => {
    const s = status({ facets: table(facet('x.a', { count: 1, tone: 'error', pulse: true })) })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('1 需要关注')
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).not.toContain('x.a')
  })

  it('label 返回空串也走兜底（那是来源在声明"我没有文案"）', () => {
    const s = status({ facets: table(facet('x.a', { count: 3, tone: 'info', pulse: false }, { label: () => '' })) })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('3 需要关注')
  })

  it('多来源按登记顺序各说一句，计数取和', () => {
    const s = status({
      running: 1,
      facets: table(
        facet('x.first', { count: 1, tone: 'info', pulse: false }, { label: fold => `${fold.count} 第一个` }),
        facet('x.second', { count: 2, tone: 'warn', pulse: false }, { label: fold => `${fold.count} 第二个` }),
      ),
    })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('1 进行中 · 1 第一个 · 2 第二个')
    expect(facetCountTotal(s)).toBe(3)
  })

  it('外部来源排在宿主状态之后、已完成之前，明细与 label 同序', () => {
    const s = status({
      approval: 1, done: 1,
      facets: table(facet('x.a', { count: 1, tone: 'warn', pulse: false }, { label: fold => `${fold.count} 陌生` })),
    })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('1 等待审批 · 1 陌生 · 1 已完成')
    expect(hoverStatusLines(s, t, ALL_ON, NOW).map(line => line.text))
      .toEqual(['1 等待审批', '1 陌生', '1 已完成'])
  })

  it('#22:脉冲逐来源判定，别家开闪不让 `pulse:false` 的来源跟着闪', () => {
    const urgent = 'IS-URGENT'
    const blinking = facet('x.a', { count: 1, tone: 'error', pulse: true })
    const still = facet('x.b', { count: 1, tone: 'warn', pulse: false })
    // 同一个 status 里两者并存 —— 这正是过去整只徽标一起呼吸的场景。
    const s = status({ facets: table(blinking, still) })
    expect(facetPulseClass(blinking, urgent)).toBe(urgent)
    // 判据只读**这一个** entry 的 fold：邻居开不开闪与它无关。
    expect(facetPulseClass(still, urgent)).toBeUndefined()
  })

  it('#22:provider 没交 pulse 时按缺省不闪', () => {
    const entry = facet('x.a', { count: 1, tone: 'error' } as AnyFacetFold)
    expect(facetPulseClass(entry, 'IS-URGENT')).toBeUndefined()
  })

  it('#24:明细行带来源自己的图标，且与徽标同源同一个元素', () => {
    const glyph = { type: 'span', props: { 'data-glyph': 'hourglass' } }
    const entry = facet('x.a', { count: 1, tone: 'error', pulse: false }, {
      label: fold => `${fold.count} 等待评审（已超时）`,
      renderIcon: () => glyph,
    })
    const lines = hoverStatusLines(status({ facets: table(entry) }), t, ALL_ON, NOW)
    expect(lines).toHaveLength(1)
    // 色档只能由来源自己的图标表达（宿主点只有三档，没有 error 档），所以必须真拿到它。
    expect(lines[0].glyph).toBe(glyph)
    expect(lines[0].text).toBe('1 等待评审（已超时）')
  })

  it('#24:provider 没交 renderIcon 时退回三档点，不留空洞', () => {
    const entry = facet('x.a', { count: 1, tone: 'error', pulse: false }, { label: fold => `${fold.count} 陌生` })
    const lines = hoverStatusLines(status({ facets: table(entry) }), t, ALL_ON, NOW)
    expect(lines[0].glyph).toBeUndefined()
    expect(lines[0].state).toBe('warning')
  })

  it('#25①:明细顺序 = 徽标点行顺序（facet 排在已完成之前）', () => {
    const s = status({
      approval: 1, done: 1,
      facets: table(facet('x.a', { count: 1, tone: 'warn', pulse: false }, { label: fold => `${fold.count} 陌生` })),
    })
    // 明细
    expect(hoverStatusLines(s, t, ALL_ON, NOW).map(line => line.text))
      .toEqual(['1 等待审批', '1 陌生', '1 已完成'])
    // label 与明细同序
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('1 等待审批 · 1 陌生 · 1 已完成')
  })

  it('#25④:同一个 `now` 决定倒计时读数——徽标与明细不会差一分钟', () => {
    // label 真的读 ctx.now：这是「倒计时会不会跨分钟说两套话」的可观测点。
    const entry = facet('x.a', { count: 1, tone: 'warn', pulse: false }, {
      label: (fold, ctx) => `${fold.count} 剩 ${Math.floor((1_000_000 - ctx.now) / 60_000)} 分钟`,
    })
    const s = status({ facets: table(entry) })
    // 显式传 `now` 时读数由它决定，不读挂钟：两次调用结果可预测地不同。
    expect(hoverStatusLines(s, t, ALL_ON, NOW).map(line => line.text)).toEqual(['1 剩 0 分钟'])
    expect(hoverStatusLines(s, t, ALL_ON, NOW - 600_000).map(line => line.text)).toEqual(['1 剩 10 分钟'])
  })
})

describe('来源交出的文本原样呈现，本插件不重算也不改写', () => {
  // 徽标对文案只做两件事：拼上计数位、按 order 排。曾经的写法是按状态名反推句子，于是
  // 提供方改了口径这里就悄悄说谎（CHANGELOG 0.2.3 第一条）。现在句子归提供方，这里只
  // 锁"原样"这条：包含 #号、括号、倒计时形状的句子都不被加工。
  const verbatim = '1 等待评审（剩 3分钟） · #2783, #15, +2'
  const s = status({ facets: table(facet('x.rich', { count: 1, tone: 'warn', pulse: false }, { label: () => verbatim })) })
  it('label 的结果逐字进 aria-label 与悬停明细', () => {
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe(verbatim)
    expect(hoverStatusLines(s, t, ALL_ON, NOW)[0]?.text).toBe(verbatim)
  })
  it('多来源时各占一段，分隔符与顺序由本插件决定', () => {
    const two = status({ facets: table(
      facet('x.a', { count: 2, tone: 'info', pulse: false }, { label: () => '2 定时任务' }),
      facet('x.b', { count: 1, tone: 'error', pulse: false }, { label: () => '1 等待评审（已超时） · #990002' }),
    ) })
    expect(groupLiveLabel(two, t, ALL_ON, NOW)).toBe('2 定时任务 · 1 等待评审（已超时） · #990002')
    expect(facetCountTotal(two)).toBe(3)
  })
  it('没有 label 时用兜底文案，且绝不读出来源 id', () => {
    const noLabel = status({ facets: table(facet('dsh-hidden.internal-id', { count: 4, tone: 'warn', pulse: false })) })
    const line = groupLiveLabel(noLabel, t, ALL_ON, NOW)
    expect(line).toBe('4 需要关注')
    expect(line).not.toContain('dsh-hidden')
  })
})

describe('设置关掉某来源时的表现', () => {
  // 过滤发生在折叠之前（`WorkspaceBrowser` 按 `facet.settingKey` 筛登记面），所以到这里
  // 的表里本就没有被关掉的来源。这两条锁住的是"筛掉之后不残留任何痕迹"。
  it('不在表里的来源不进 label、明细与计数', () => {
    const s = status({ running: 1, facets: table() })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('1 进行中')
    expect(facetCountTotal(s)).toBe(0)
    expect(hoverStatusLines(s, t, ALL_ON, NOW).map(line => line.text)).toEqual(['1 进行中'])
  })

  it('showHoverDetails 关掉时明细整段为空，label 不受影响', () => {
    const s = status({ facets: table(facet('x.a', { count: 1, tone: 'warn', pulse: false }, { label: () => '1 陌生' })) })
    expect(hoverStatusLines(s, t, { ...ALL_ON, showHoverDetails: false }, NOW)).toEqual([])
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('1 陌生')
  })
})
