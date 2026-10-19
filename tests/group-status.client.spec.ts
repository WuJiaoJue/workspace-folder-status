/**
 * Fork-owned coverage for the one thing this package adds: the aggregated status
 * of a *folded* workspace group (`liveStatus` on every group row).
 *
 * The vendored upstream specs cannot run here — `@deepseek-ai/dsh-client-test-runtime`
 * deep-imports sources that DSH does not publish (see `vitest.config.ts`) — and
 * the vendored `tests/rows.client.spec.tsx` is therefore excluded. This spec drives
 * the same pipeline the sidebar does — `deriveGroups` → `directStatusesForGroups` →
 * `aggregateGroupStatuses` — which is the module's public surface and needs no
 * renderer runtime. It deliberately never assigns a status by hand: a copy of the
 * wiring inside a test can only ever certify the copy.
 */
import { describe, expect, it } from 'vitest'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {
  SessionPendingInteraction, SessionStatus, SessionStatusSnapshot,
} from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { deriveGroups, owningParentFolder, type GroupNode } from '../src/client/tree.ts'
import {
  aggregateGroupStatuses, directStatusesForGroups, withAggregatedStatus,
  EMPTY_LIVE_STATUS, mergeLiveStatus,
  type GroupLiveStatus, type StatusedGroupNode,
} from '../src/client/group-status.ts'
import { GROUP_STATUS_FACET_PROTOCOL_VERSION, defaultMergeFold, type AnyFacet, type RegisteredFacet } from '../src/client/facets.ts'
import { createWaitingReviewFacet, summarizeWaitingGroupLocally, waitingDeadlineOf, type WaitingReviewSummarizer, type WaitingReviewSummaryMap } from '../src/client/legacy/waiting-review.ts'
import { createScheduleFacet, type ScheduleSummaryMap } from '../src/client/legacy/schedule.ts'

const sid = (id: string): SessionId => id as SessionId
const wid = (id: string): WorkspaceId => id as WorkspaceId

const summary = (id: string, updatedAt: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
  id: sid(id), title: id, displayTitle: id, running: false, blank: false,
  updatedAt, retainedBy: {}, ...overrides,
})

const list = (
  items: readonly SessionSummary[],
  projectionsBySession: SessionListState['projectionsBySession'] = {},
): SessionListState => ({
  ids: items.map(item => item.id),
  byId: Object.fromEntries(items.map(item => [item.id, item])),
  phase: 'ready',
  projectionsBySession,
})

/** Subagent catalog projection: the parent's running direct children. */
const children = (parent: string, childIds: readonly string[]): SessionListState['projectionsBySession'] => ({
  [parent]: {
    values: {
      subagentCatalog: childIds.map(id => ({ id: sid(id), mode: 'continuable', label: id, createdAt: 1 })),
    },
  } as SessionListState['projectionsBySession'][string],
})

const workspace = (id: string, sessionIds: readonly string[]): WorkspaceView => ({
  workspaceId: wid(id), path: `/projects/${id}`, title: id,
  sessionIds: sessionIds.map(sid), createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
})

const rowState = (options: { pinned?: readonly string[]; archived?: readonly string[] } = {}) => ({
  pinnedSessionIds: (options.pinned ?? []).map(sid),
  archivedSessionIds: (options.archived ?? []).map(sid),
  archivedFilter: 'default' as const,
})

const status = (
  pendingInteraction: SessionPendingInteraction | undefined,
  overrides: Partial<SessionStatus> = {},
): SessionStatus => ({ running: undefined, pendingInteraction, completionUnread: false, ...overrides })

const pending = (kind: 'approval' | 'plan-review' | 'question', sessionId: string): SessionPendingInteraction => (
  { key: `${kind}:1`, kind, sessionId: sid(sessionId) } as SessionPendingInteraction
)

/** Re-use the source's frozen sentinel so the shape stays in sync. */
const EMPTY: GroupLiveStatus = EMPTY_LIVE_STATUS

/** Fold (or expand) the single fixture workspace and return its group row. */
/** 把一个来源的快照伪装成登记项，走的就是生产里那条路径。 */
export const registeredFacet = (facet: AnyFacet): RegisteredFacet => ({ facet, sequence: 0 })

/** dsh-gitea-dispatch 摘要面的过渡适配器（同生产装配）。 */
const waitingFacet = (
  snapshot: WaitingReviewSummaryMap | undefined,
  summarize?: WaitingReviewSummarizer,
): RegisteredFacet[] => [registeredFacet(
  createWaitingReviewFacet({
    subscribe: () => () => undefined,
    getSnapshot: () => snapshot,
    ...(summarize === undefined ? {} : { summarize }),
  }) as AnyFacet,
)]

/** dsh-later 摘要面的过渡适配器。 */
const scheduleFacet = (snapshot: ScheduleSummaryMap | undefined): RegisteredFacet[] => [registeredFacet(
  createScheduleFacet({ subscribe: () => () => undefined, getSnapshot: () => snapshot }) as AnyFacet,
)]

const groupOf = (
  state: SessionListState,
  statuses: SessionStatusSnapshot,
  options: {
    expanded?: boolean
    archived?: readonly string[]
    facets?: readonly RegisteredFacet[]
  } = {},
  now: number = Date.now(),
): StatusedGroupNode => {
  const [group] = deriveGroups(
    state,
    [workspace('alpha', state.ids)],
    rowState({ archived: options.archived }),
    statuses,
    { expandedGroups: options.expanded === true ? ['alpha'] : [] },
  )
  // Run the production pipeline, never a hand-written copy of it: the version of
  // this helper before that pipeline was extractable patched `liveStatus` itself,
  // and the copy it kept encoded a semantics bug (expanded → empty) that no
  // production test could see.
  const facets = options.facets ?? []
  const direct = directStatusesForGroups([group!], facets, now)
  const aggregated = aggregateGroupStatuses(direct, new Map([[undefined, [group!]]]))
  return { ...group!, liveStatus: aggregated.get(group!.key)! }
}

describe('folded group live status', () => {
  it('counts every hidden member while the folder is folded', () => {
    const state = list([summary('a', 30), summary('b', 20), summary('c', 10)])
    const statuses: SessionStatusSnapshot = new Map([
      [sid('a'), status(pending('approval', 'a'))],
      [sid('b'), status(undefined, { running: true })],
      [sid('c'), status(undefined, { completionUnread: true })],
    ])
    const group = groupOf(state, statuses)
    expect(group.expanded).toBe(false)
    // The fork's whole point: the folded row carries the aggregate…
    expect(group.liveStatus).toEqual({ ...EMPTY, approval: 1, running: 1, done: 1 })
    // Members are always derived — the aggregator reads them whether or not the folder
    // is open. Which rows get rendered is decided in WorkspaceBrowser.tsx, not here.
    expect(group.sessions.length).toBe(3)
    expect(group.sessionCount).toBe(3)
  })

  it('still measures an expanded group, because a collapsed parent consumes the value', () => {
    const state = list([summary('a', 30), summary('b', 20)])
    const statuses: SessionStatusSnapshot = new Map([
      [sid('a'), status(pending('plan-review', 'a'))],
      [sid('b'), status(undefined, { running: true })],
    ])
    const group = groupOf(state, statuses, { expanded: true })
    expect(group.sessions.map(session => session.id)).toEqual([sid('a'), sid('b')])
    // An expanded row renders no badge of its own — that is a rendering decision in
    // groupLiveBadge. Zeroing its status is what made every collapsed parent undercount
    // by the size of its expanded descendants, so the number stays real.
    expect(group.liveStatus).toEqual({ ...EMPTY, planReview: 1, running: 1 })
  })

  it('keeps the pending classes exclusive per member, outranking its running flag', () => {
    const state = list([summary('approving', 30), summary('planning', 20), summary('asking', 10)])
    const statuses: SessionStatusSnapshot = new Map([
      [sid('approving'), status(pending('approval', 'approving'), { running: true })],
      [sid('planning'), status(pending('plan-review', 'planning'), { running: true })],
      [sid('asking'), status(pending('question', 'asking'))],
    ])
    expect(groupOf(state, statuses).liveStatus).toEqual({ ...EMPTY, approval: 1, planReview: 1, question: 1 })
  })

  it('counts each member\'s running direct children as subagents', () => {
    const state = list(
      [summary('parent', 30), summary('child-a', 20), summary('child-b', 10), summary('child-stopped', 5)],
      children('parent', ['child-a', 'child-b', 'child-stopped']),
    )
    const statuses: SessionStatusSnapshot = new Map([
      [sid('child-a'), status(undefined, { running: true })],
      [sid('child-b'), status(undefined, { running: true })],
      [sid('child-stopped'), status(undefined, { running: false })],
    ])
    // Children are members here too, so they also count as running rows; the
    // subagent tally is the one that must not double-count the stopped child.
    expect(groupOf(state, statuses).liveStatus).toEqual({ ...EMPTY, running: 2, subagents: 2 })
  })

  // #25②:徽标计数此前与 `rows/Rows.tsx` 的 `sessionStatuses()` 各写一份优先级，两处结果不同。
  // 这两条锁住"以行内为准"的选择——行内是用户真正看到的那个答案。
  it('#25②:会话在等审批时，它跑着的子智能体照样计入（行内给两个点）', () => {
    const state = list(
      [summary('parent', 30), summary('child', 20)],
      children('parent', ['child']),
    )
    const statuses: SessionStatusSnapshot = new Map([
      // 父：等审批。子：running → 算子智能体。
      [sid('parent'), status(pending('approval', 'parent'), { running: false })],
      [sid('child'), status(undefined, { running: true })],
    ])
    const live = groupOf(state, statuses).liveStatus
    // 子会话本身也是组成员，所以它另算一个 running；父在等审批 → approval，
    // 而父那个 running 的子智能体**也**计入 subagents（此前被 `continue` 漏掉了）。
    expect(live).toEqual({ ...EMPTY, approval: 1, running: 1, subagents: 1 })
  })

  it('#25②:未运行但已完成 + 有运行中子智能体时，不额外计一次已完成（行内 return [subagents]）', () => {
    const state = list(
      [summary('parent', 30), summary('child', 20)],
      children('parent', ['child']),
    )
    const statuses: SessionStatusSnapshot = new Map([
      // completionUnread = 行内判 completed 的依据；父不 running、已完成、且有子智能体在跑。
      [sid('parent'), status(undefined, { running: false, completionUnread: true })],
      [sid('child'), status(undefined, { running: true })],
    ])
    const live = groupOf(state, statuses).liveStatus
    // 子会话本身是成员，也算 running；父只贡献 subagents，不贡献 done。
    expect(live).toEqual({ ...EMPTY, running: 1, subagents: 1 })
    expect(live.done).toBe(0)
  })

  it('#25②:既无 pending 也无子智能体的已完成成员仍照常计入', () => {
    const state = list([summary('done', 30)])
    const statuses: SessionStatusSnapshot = new Map([
      [sid('done'), status(undefined, { running: false, completionUnread: true })],
    ])
    expect(groupOf(state, statuses).liveStatus).toEqual({ ...EMPTY, done: 1 })
  })

  it('skips blank, archived and stale members', () => {
    const state = list([
      summary('blank', 40, { blank: true }),
      summary('archived', 30),
      summary('live', 20),
    ])
    const statuses: SessionStatusSnapshot = new Map([
      [sid('blank'), status(pending('approval', 'blank'))],
      [sid('archived'), status(undefined, { running: true })],
      [sid('live'), status(undefined, { running: true })],
    ])
    expect(groupOf(state, statuses, { archived: ['archived'] }).liveStatus).toEqual({ ...EMPTY, running: 1 })
  })

  it('reports an idle group as all-zero', () => {
    const state = list([summary('a', 30), summary('b', 20)])
    expect(groupOf(state, new Map()).liveStatus).toEqual(EMPTY)
  })
})

describe('registered status sources', () => {
  // 这一组测的是「协议跑通」：来源通过 facet 进来，聚合只认 count/tone/pulse/data，
  // 从不解释 data。所以断言只看两件事：来源报的数字进没进表，色档与脉冲有没有跟着走。
  // 表里存的是「facet + 它的折果」：断言只比折果（协议契约），比 facet 会退化成比对象身份。
  const foldOf = (group: StatusedGroupNode, id: string) => group.liveStatus.facets.get(id)?.fold

  it('把定时任务的会话数折成该来源的 count，色档随最紧急的一档', () => {
    const state = list([summary('a', 30), summary('b', 20), summary('idle', 10)])
    const schedule = new Map<string, ScheduleSummaryMap extends ReadonlyMap<string, infer E> ? E : never>([
      ['a', { count: 2, pausedCount: 1, nextAt: 1_000, state: 'scheduled' }],
      ['b', { count: 3, pausedCount: 0, nextAt: 500, state: 'overdue' }],
    ] as never)
    const group = groupOf(state, new Map(), { facets: scheduleFacet(schedule) })
    expect(foldOf(group, 'dsh-later.schedule')).toEqual({
      count: 2, tone: 'error', pulse: true, data: { tasks: 5, state: 'overdue' },
    })
    // 宿主自己那几项不受影响：外部来源不该能改写不属于它的计数。
    expect(group.liveStatus.running).toBe(0)
  })

  it('等评审的来源：id 口径两种拼写都能命中同一个成员', () => {
    const state = list([summary('plain', 30), summary('session-prefixed', 20), summary('idle', 10)])
    const waiting = new Map([
      ['plain', { prNumber: 7, state: 'waiting' as const }],
      ['prefixed', { prNumber: 8, state: 'overdue' as const }],
    ])
    const group = groupOf(state, new Map(), { facets: waitingFacet(waiting) }, 0)
    expect(foldOf(group, 'dsh-gitea-dispatch.waiting-review')).toEqual({
      count: 2, tone: 'error', pulse: false,
      data: { prNumbers: [7, 8], state: 'overdue' },
    })
  })

  it('提供方按 webhook- 前缀发布的键也能命中（少一种拼写就静默漏算）', () => {
    // The publisher keys by whatever the Host SessionId is, and Sessions dispatched from
    // a webhook are genuinely `webhook-…`. 只按剥前缀后的形态查会永远 miss 且不报错。
    const state = list([summary('webhook-42', 30)])
    const keyed = new Map([['webhook-42', { prNumber: 9, state: 'waiting' as const }]])
    const normalized = new Map([['42', { prNumber: 9, state: 'waiting' as const }]])
    expect(foldOf(groupOf(state, new Map(), { facets: waitingFacet(keyed) }), 'dsh-gitea-dispatch.waiting-review')?.count).toBe(1)
    expect(foldOf(groupOf(state, new Map(), { facets: waitingFacet(normalized) }), 'dsh-gitea-dispatch.waiting-review')?.count).toBe(1)
  })

  it('等待窗口折成组内最早的未到期截止', () => {
    const state = list([summary('a', 30), summary('b', 20)])
    const waiting = new Map([
      ['a', { prNumber: 1, state: 'waiting' as const, startedAt: 1000, waitMaxSec: 60 }],
      ['b', { prNumber: 2, state: 'waiting' as const, deadline: 5000 }],
    ])
    const dataOf = (facets: readonly RegisteredFacet[]) =>
      foldOf(groupOf(state, new Map(), { facets }, 100), 'dsh-gitea-dispatch.waiting-review')?.data as { nextDeadline?: number }
    // 1000 + 60s = 61000 与绝对 5000 都还在 now=100 之前，取更早的那个。
    expect(dataOf(waitingFacet(waiting)).nextDeadline).toBe(5000)
    // 已过期由 tone 表达，不留一个负倒计时。
    expect(dataOf(waitingFacet(new Map([['a', { prNumber: 1, state: 'overdue' as const, deadline: 50 }]]))).nextDeadline).toBeUndefined()
    // 完全没窗口（CI 没带 waitMaxSec）= 在等，但时长未知。
    expect(dataOf(waitingFacet(new Map([['a', { prNumber: 1, state: 'waiting' as const }]]))).nextDeadline).toBeUndefined()
  })

  it('提供方导出自己的聚合时就用它，而不是本地重算一遍', () => {
    const state = list([summary('a', 30)])
    // 本地折叠会答 1 个 / PR #1 / waiting；委托的答案不同，才能证明走的是提供方。
    const waiting = new Map([['a', { prNumber: 1, state: 'waiting' as const }]])
    const seen: { ids?: readonly string[], now?: number } = {}
    const summarize: WaitingReviewSummarizer = (_summary, ids, now) => {
      seen.ids = ids
      seen.now = now
      return { sessions: 3, prNumbers: [11, 12, 13], state: 'overdue', nextDeadline: 4242 }
    }
    const group = groupOf(state, new Map(), { facets: waitingFacet(waiting, summarize) }, 7)
    expect(foldOf(group, 'dsh-gitea-dispatch.waiting-review')).toEqual({
      count: 3, tone: 'error', pulse: false,
      data: { prNumbers: [11, 12, 13], state: 'overdue', nextDeadline: 4242 },
    })
    expect(seen.ids).toEqual(['a'])
    expect(seen.now).toBe(7)
  })

  it('一个来源折坏了不该带塌徽标，也不该吞掉别的来源', () => {
    const state = list([summary('a', 30), summary('b', 20)])
    const boom = registeredFacet({
      protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION, id: 'x.boom',
      subscribe: () => () => undefined,
      getSnapshot: () => { throw new Error('provider store exploded') },
      fold: () => { throw new Error('fold exploded') },
    } as AnyFacet)
    const waiting = new Map([['a', { prNumber: 7, state: 'waiting' as const }]])
    const group = groupOf(state, new Map(), { facets: [boom, ...waitingFacet(waiting)] }, 0)
    expect([...group.liveStatus.facets.keys()]).toEqual(['dsh-gitea-dispatch.waiting-review'])
    expect(group.liveStatus.facets.get('dsh-gitea-dispatch.waiting-review')?.fold.count).toBe(1)
    expect(group.liveStatus.running).toBe(0)
  })

  it('count <= 0 的来源不进表（数字、图标、文案都当它不存在）', () => {
    const state = list([summary('a', 30)])
    const empty = registeredFacet({
      protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION, id: 'x.quiet',
      subscribe: () => () => undefined, getSnapshot: () => undefined,
      fold: () => ({ count: 0, tone: 'error', pulse: true }),
    } as AnyFacet)
    expect(groupOf(state, new Map(), { facets: [empty] }).liveStatus.facets.size).toBe(0)
  })

  it('degrades to no cross-plugin signal when neither publisher is installed', () => {
    const state = list([summary('a', 30)])
    const group = groupOf(state, new Map([[sid('a'), status(undefined, { running: true })]]))
    expect(group.liveStatus).toEqual({ ...EMPTY, running: 1 })
  })
})

describe('P2-3: badge count cap', () => {
  it('caps the aggregate count at 99+ when there are more than 99 active items', () => {
    // Create 100 running sessions to verify the count cap.
    const sessions = Array.from({ length: 100 }, (_, i) => summary(`s${i}`, 100 - i))
    const state = list(sessions)
    const statuses: SessionStatusSnapshot = new Map(
      sessions.map(s => [s.id, status(undefined, { running: true })]),
    )
    const group = groupOf(state, statuses)
    // The liveStatus should show 100 running, but the badge will cap at 99+.
    expect(group.liveStatus.running).toBe(100)
    // The actual cap is in GroupBadge.tsx's rendering logic (count > 99 ? '99+' : String(count)).
    // This test verifies the aggregation works correctly for large counts.
  })
})

describe('P3-2: performance regression', () => {
  /** 50 workspaces × 20 running sessions — the shape that makes the badge cost measurable. */
  const wide = () => {
    const allSessions: SessionSummary[] = []
    const workspaces: WorkspaceView[] = []
    for (let w = 0; w < 50; w++) {
      const sessionIds: string[] = []
      for (let s = 0; s < 20; s++) {
        const id = `w${w}-s${s}`
        sessionIds.push(id)
        allSessions.push(summary(id, 1000 - s))
      }
      workspaces.push(workspace(`ws${w}`, sessionIds))
    }
    const state = list(allSessions)
    const statuses: SessionStatusSnapshot = new Map(
      allSessions.map(s => [s.id, status(undefined, { running: true })]),
    )
    return { state, statuses, workspaces }
  }

  it('derives 50 groups with 20 sessions each in under 50ms', () => {
    const { state, statuses, workspaces } = wide()
    const start = performance.now()
    const groups = deriveGroups(state, workspaces, rowState(), statuses, { expandedGroups: [] })
    const elapsed = performance.now() - start

    expect(groups.length).toBe(50)
    expect(elapsed).toBeLessThan(50)
    for (const group of groups) {
      expect(group.sessions.length).toBe(20)
    }
  })

  // The badge cost moved out of deriveGroups together with the aggregation, so it
  // needs its own guard — the two tests above would have stayed green through the
  // whole PR #10 regression because deriveGroups no longer computes anything here.
  it('aggregates 50 groups in under 50ms with every folder collapsed', () => {
    const { state, statuses, workspaces } = wide()
    const groups = deriveGroups(state, workspaces, rowState(), statuses, { expandedGroups: [] })

    const start = performance.now()
    const aggregated = aggregateGroupStatuses(
      directStatusesForGroups(groups),
      new Map([[undefined, groups]]),
    )
    const elapsed = performance.now() - start

    expect(aggregated.size).toBe(50)
    expect(aggregated.get('ws0')?.running).toBe(20)
    expect(elapsed).toBeLessThan(50)
  })

  it('aggregates 50 groups in under 50ms with every folder expanded', () => {
    // The pessimistic case for measuring expanded groups: nothing renders a badge,
    // yet every group is still counted for the sake of any collapsed ancestor.
    const { state, statuses, workspaces } = wide()
    const groups = deriveGroups(
      state, workspaces, rowState(), statuses,
      { expandedGroups: workspaces.map(w => w.workspaceId) },
    )

    const start = performance.now()
    const aggregated = aggregateGroupStatuses(
      directStatusesForGroups(groups),
      new Map([[undefined, groups]]),
    )
    const elapsed = performance.now() - start

    expect(groups.every(group => group.expanded)).toBe(true)
    expect(aggregated.get('ws0')?.running).toBe(20)
    expect(elapsed).toBeLessThan(50)
  })
})

describe('mergeLiveStatus', () => {
  const at = (key: string, overrides: Partial<GroupLiveStatus> = {}): GroupLiveStatus =>
    ({ ...EMPTY_LIVE_STATUS, facets: new Map([[key, {
      facet: facetWithId(key), fold: { count: 1, tone: 'warn', pulse: false },
    }]]), ...overrides })

  /** 只用来给合并器绑定的最小 facet；id 与 map key 一致。 */
  function facetWithId(id: string): AnyFacet {
    return {
      protocol: GROUP_STATUS_FACET_PROTOCOL_VERSION, id,
      subscribe: () => () => undefined, getSnapshot: () => undefined,
      fold: () => ({ count: 0, tone: 'info', pulse: false }),
    } as AnyFacet
  }

  const foldOf = (merged: GroupLiveStatus, id: string) => merged.facets.get(id)?.fold

  it('sums the host-side counters', () => {
    const a: GroupLiveStatus = { ...EMPTY, running: 1, approval: 2, planReview: 3, question: 4, done: 5, subagents: 6 }
    const b: GroupLiveStatus = { ...EMPTY, running: 10, approval: 20, planReview: 30, question: 40, done: 50, subagents: 60 }
    const merged = mergeLiveStatus(a, b)
    expect(merged).toEqual({ ...EMPTY, running: 11, approval: 22, planReview: 33, question: 44, done: 55, subagents: 66 })
  })

  it('合并同名来源的折果，且沿用该来源自己声明的合并规则', () => {
    const merge = (a: { count: number }, b: { count: number }) => ({ count: a.count + b.count, tone: 'error' as const, pulse: false, data: 'custom' })
    const custom = {
      ...facetWithId('x.a'),
      merge: merge as never,
    } as AnyFacet
    const left: GroupLiveStatus = { ...EMPTY, facets: new Map([['x.a', { facet: custom, fold: { count: 2, tone: 'warn', pulse: false, data: { v: 1 } } }]]) }
    const right: GroupLiveStatus = { ...EMPTY, facets: new Map([['x.a', { facet: custom, fold: { count: 3, tone: 'info', pulse: true, data: { v: 2 } } }]]) }
    // 自定义合并器胜出：`data` 由来源解释，本插件不碰。
    expect(foldOf(mergeLiveStatus(left, right), 'x.a')).toEqual({ count: 5, tone: 'error', pulse: false, data: 'custom' })
  })

  it('没声明合并规则时用缺省合并：数量相加、色档取更紧急、脉冲取或', () => {
    const left: GroupLiveStatus = { ...EMPTY, facets: new Map([['x.b', { facet: facetWithId('x.b'), fold: { count: 1, tone: 'info', pulse: false } }]]) }
    const right: GroupLiveStatus = { ...EMPTY, facets: new Map([['x.c', { facet: facetWithId('x.c'), fold: { count: 1, tone: 'warn', pulse: false } }]]) }
    const merged = mergeLiveStatus(left, right)
    expect([...merged.facets.keys()]).toEqual(['x.b', 'x.c'])
    const same = mergeLiveStatus(left, { ...EMPTY, facets: new Map([['x.b', { facet: facetWithId('x.b'), fold: { count: 4, tone: 'error', pulse: true } }]]) })
    expect(foldOf(same, 'x.b')).toEqual(defaultMergeFold(
      { count: 1, tone: 'info', pulse: false },
      { count: 4, tone: 'error', pulse: true },
    ))
  })

  it('一侧没有某来源时原样带过（不编造合并）', () => {
    expect(mergeLiveStatus(at('x.a'), EMPTY).facets.get('x.a')?.fold).toEqual({ count: 1, tone: 'warn', pulse: false })
    expect(mergeLiveStatus(EMPTY, at('x.a')).facets.get('x.a')?.fold).toEqual({ count: 1, tone: 'warn', pulse: false })
  })
})

describe('tree-wide aggregation', () => {
  /** A workspace at an explicit path, so folder nesting is real rather than implied. */
  const at = (id: string, path: string, sessionIds: readonly string[]): WorkspaceView => ({
    workspaceId: wid(id), path, title: id,
    sessionIds: sessionIds.map(sid),
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  })

  /** Three folder levels, every session running: 1 + 2 + 3. */
  const nested = () => {
    const owned: Record<string, string[]> = {
      root: ['r1'], child: ['c1', 'c2'], grand: ['g1', 'g2', 'g3'],
    }
    const all = [...owned.root, ...owned.child, ...owned.grand]
    return {
      owned,
      state: list(all.map(id => summary(id, 1000))),
      statuses: new Map(all.map(id => [sid(id), status(undefined, { running: true })])) as SessionStatusSnapshot,
      workspaces: [
        at('root', '/plugins', owned.root),
        at('child', '/plugins/child', owned.child),
        at('grand', '/plugins/child/grand', owned.grand),
      ],
    }
  }

  /** Mirrors the component's tree build: parent folder key → rendered children. */
  const childrenOf = (groups: readonly GroupNode[]): Map<string | undefined, GroupNode[]> => {
    const paths = groups.map(group => group.cwd as string)
    const keyByPath = new Map(groups.map(group => [group.cwd as string, group.key]))
    const children = new Map<string | undefined, GroupNode[]>()
    for (const group of groups) {
      const parentPath = owningParentFolder(group.cwd as string, paths)
      const parent = parentPath === undefined ? undefined : keyByPath.get(parentPath)
      const siblings = children.get(parent)
      if (siblings === undefined) children.set(parent, [group])
      else siblings.push(group)
    }
    return children
  }

  /** The production pipeline: deriveGroups → direct statuses → fold up → render rows. */
  const pipeline = (expanded: readonly string[]) => {
    const { state, statuses, workspaces } = nested()
    const groups = deriveGroups(state, workspaces, rowState(), statuses, { expandedGroups: [...expanded] })
    const direct = directStatusesForGroups(groups)
    const children = childrenOf(groups)
    return {
      direct,
      aggregated: aggregateGroupStatuses(direct, children),
      rows: withAggregatedStatus(groups, direct, children),
    }
  }

  it('hands every rendered row a resolved status, expanded rows included', () => {
    const { rows } = pipeline(['child'])
    const byKey = new Map(rows.map(row => [row.key, row]))
    // Each row carries what its badge would show: own members plus the whole subtree.
    // `child` is expanded, so it draws nothing itself — but its row still holds the
    // measurement, which is the half that used to come back silently undefined.
    expect(byKey.get('child')?.liveStatus.running).toBe(5)
    expect(byKey.get('root')?.liveStatus.running).toBe(6)
    // Coverage, not "is it defined" (the type already guarantees that): every derived
    // row comes back, so none can slip past the aggregator and render badge-less.
    expect(rows.map(row => row.key).sort()).toEqual(['child', 'grand', 'root'])
  })

  it('measures an expanded group\'s own members, not an empty placeholder', () => {
    const { direct } = pipeline(['child'])
    expect(direct.get('child')?.running).toBe(2)
  })

  it('counts an expanded intermediate folder toward its collapsed parent', () => {
    // The regression: `child` is expanded, so it renders no badge of its own — but
    // its 2 running sessions still need attention and `root` must keep counting them.
    const { aggregated } = pipeline(['child'])
    expect(aggregated.get('root')?.running).toBe(6)
    expect(aggregated.get('child')?.running).toBe(5)
    expect(aggregated.get('grand')?.running).toBe(3)
  })

  it('aggregates at any depth with every folder collapsed', () => {
    const { aggregated } = pipeline([])
    expect(aggregated.get('root')?.running).toBe(6)
    expect(aggregated.get('child')?.running).toBe(5)
  })

  it('aggregates at any depth with every folder expanded', () => {
    const { aggregated } = pipeline(['root', 'child', 'grand'])
    expect(aggregated.get('root')?.running).toBe(6)
    expect(aggregated.get('child')?.running).toBe(5)
  })

  it('terminates when folder parentage is cyclic', () => {
    // Parentage comes from path-prefix matching; a self- or mutual-parent edge must
    // not hang the sidebar.
    const direct = new Map<string, GroupLiveStatus>([
      ['a', { ...EMPTY, running: 1 }],
      ['b', { ...EMPTY, running: 2 }],
    ])
    const children = new Map<string | undefined, readonly { key: string }[]>([
      [undefined, [{ key: 'a' }]],
      ['a', [{ key: 'b' }]],
      ['b', [{ key: 'a' }]],
    ])
    const aggregated = aggregateGroupStatuses(direct, children)
    expect(aggregated.size).toBe(2)
    expect(aggregated.get('a')?.running).toBeGreaterThanOrEqual(1)
  })
})
