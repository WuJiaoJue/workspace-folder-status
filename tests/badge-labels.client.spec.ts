/**
 * Fork-owned coverage for the badge **wording**, the part that carries a
 * cross-plugin state to the user.
 *
 * This lives apart from `rows/GroupBadge.tsx` on purpose: that module imports the
 * host icon set, which resolves to a closure bundle whose `require` graph only exists
 * inside the DSH app (`vitest.config.ts`, exclusion reason (b)). The wording is a pure
 * fold over `GroupLiveStatus`, so it is testable here. It is also the wording that had
 * silently dropped everything dsh-gitea-dispatch published beyond `state`.
 */
import { describe, expect, it } from 'vitest'
import { zh } from '../src/client/locales.ts'
import { groupBadgeIsUrgent, groupLiveLabel, hoverStatusLines, waitingReviewLabel } from '../src/client/badge-labels.ts'
import { EMPTY_LIVE_STATUS, type GroupLiveStatus } from '../src/client/group-status.ts'

/** Real dictionary, interpolated the way the host's `t` does (`{n}`, `{time}`). */
const t = ((key: string, options?: Record<string, string | number>): string => {
  const template = zh[key as keyof typeof zh]
  if (template === undefined) return key
  if (options === undefined) return template
  return template.replace(/\{(\w+)\}/g, (all, name: string) => String(options[name] ?? all))
}) as never

const ALL_ON = {
  showPendingInBadge: true, showRunningInBadge: true, showCompletedInBadge: true,
  showScheduledInBadge: true, showWaitingReviewInBadge: true,
  showHoverDetails: true, countThreshold: 2,
} as const

const NOW = 1_000_000

const waiting = (overrides: Partial<GroupLiveStatus>): GroupLiveStatus => ({
  ...EMPTY_LIVE_STATUS, ...overrides,
})

describe('waiting-review wording', () => {
  it('says the state, not just the colour, for the publisher\'s two waiting states', () => {
    const plain = waiting({ waitingReviewCount: 1, waitingReviewState: 'waiting' })
    const late = waiting({ waitingReviewCount: 1, waitingReviewState: 'overdue' })
    expect(waitingReviewLabel(plain, t, NOW)).toBe('等待评审')
    expect(waitingReviewLabel(late, t, NOW)).toBe('等待评审（已超时）')
    // The distinction this replaces: both used to read `等待评审`, so `overdue` lived
    // only in the icon colour, which the badge's own comment forbids as the sole cue.
    expect(waitingReviewLabel(late, t, NOW)).not.toBe(waitingReviewLabel(plain, t, NOW))
  })

  it('counts down to the publisher\'s deadline in whole minutes', () => {
    const at = (leftMs: number) => waiting({
      waitingReviewCount: 1, waitingReviewState: 'waiting', waitingReviewNextDeadline: NOW + leftMs,
    })
    expect(waitingReviewLabel(at(3 * 60_000 + 12_000), t, NOW)).toBe('等待评审（剩 3分钟）')
    expect(waitingReviewLabel(at(2 * 3_600_000), t, NOW)).toBe('等待评审（剩 2小时）')
    // Sub-minute stays coarse: the badge only re-renders when the store notifies, so a
    // seconds readout would freeze and then lie.
    expect(waitingReviewLabel(at(40_000), t, NOW)).toBe('等待评审（1分钟内到期）')
  })

  it('claims no countdown when the publisher published no window', () => {
    // CI may send no waitMaxSec (broadcast field lost, dedup hit): the wait is real, its
    // duration is not knowable; the publisher renders that shape without a countdown too.
    const noWindow = waiting({ waitingReviewCount: 2, waitingReviewState: 'waiting', waitingReviewPrNumbers: [15, 2783] })
    expect(waitingReviewLabel(noWindow, t, NOW)).toBe('等待评审')
    expect(waitingReviewLabel(noWindow, t, NOW)).not.toContain('剩')
  })

  it('names the PRs the group is waiting on', () => {
    const one = waiting({ waitingReviewCount: 1, waitingReviewState: 'waiting', waitingReviewPrNumbers: [2783] })
    expect(groupLiveLabel(one, t, ALL_ON, NOW)).toBe('1 等待评审 · #2783')
    // Capped, with the remainder counted: the number in front already says how many.
    const many = waiting({
      waitingReviewCount: 5, waitingReviewState: 'waiting',
      waitingReviewPrNumbers: [1, 2, 3, 4, 5],
    })
    expect(groupLiveLabel(many, t, ALL_ON, NOW)).toBe('5 等待评审 · #1, #2, #3, +2')
  })

  it('collapses two members waiting on the same PR into one number', () => {
    // The publisher lists a PR per waiting member, so `[15, 15]` is a real shape; reading
    // it back verbatim would advertise two PRs where the folder has one.
    const shared = waiting({
      waitingReviewCount: 2, waitingReviewState: 'waiting', waitingReviewPrNumbers: [15, 15],
    })
    expect(groupLiveLabel(shared, t, ALL_ON, NOW)).toBe('2 等待评审 · #15')
    expect(hoverStatusLines(shared, t, ALL_ON, NOW)[0]?.text).toBe('2 等待评审 · #15')
  })

  it('keeps the source switched off out of the label and the hover details', () => {
    const s = waiting({ waitingReviewCount: 2, waitingReviewState: 'overdue', waitingReviewPrNumbers: [7, 8] })
    const off = { ...ALL_ON, showWaitingReviewInBadge: false }
    expect(groupLiveLabel(s, t, off, NOW)).toBe('')
    expect(hoverStatusLines(s, t, off, NOW)).toEqual([])
    expect(hoverStatusLines(s, t, { ...ALL_ON, showHoverDetails: false }, NOW)).toEqual([])
  })

  it('puts the same state, countdown and PRs in the hover detail line', () => {
    const s = waiting({
      waitingReviewCount: 1, waitingReviewState: 'waiting',
      waitingReviewPrNumbers: [15], waitingReviewNextDeadline: NOW + 60_000,
    })
    expect(hoverStatusLines(s, t, ALL_ON, NOW)).toEqual([
      { state: 'warning', text: '1 等待评审（剩 1分钟） · #15' },
    ])
  })

  it('reads every published state through one label', () => {
    const s = waiting({
      running: 2, waitingReviewCount: 1, waitingReviewState: 'overdue', waitingReviewPrNumbers: [990002],
    })
    expect(groupLiveLabel(s, t, ALL_ON, NOW)).toBe('2 进行中 · 1 等待评审（已超时） · #990002')
  })

  it('still says nothing when no member is waiting', () => {
    expect(groupLiveLabel(waiting({ running: 1 }), t, ALL_ON, NOW)).toBe('1 进行中')
  })
})

describe('badge pulse', () => {
  it('pulses for a lapsed scheduled reminder', () => {
    expect(groupBadgeIsUrgent(waiting({ scheduleState: 'overdue' }))).toBe(true)
    expect(groupBadgeIsUrgent(waiting({ scheduleState: 'urgent' }))).toBe(true)
  })

  it('never pulses for a waiting-review overdue', () => {
    // dsh-gitea-dispatch draws `overdue` **statically** on purpose, and its `overdue`
    // means "CI stopped waiting", not "the review failed". A pulsing folder next to a
    // still session-row icon would state the same fact two ways.
    expect(groupBadgeIsUrgent(waiting({
      waitingReviewCount: 1, waitingReviewState: 'overdue', waitingReviewPrNumbers: [15],
    }))).toBe(false)
    expect(groupBadgeIsUrgent(waiting({ waitingReviewCount: 1, waitingReviewState: 'waiting' }))).toBe(false)
    expect(groupBadgeIsUrgent(waiting({}))).toBe(false)
  })
})
