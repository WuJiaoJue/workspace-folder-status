import { describe, expect, it } from 'vitest'
import type { SessionNode } from '../src/client/tree.ts'
import {
  raiseWatermarks, requiredWatermark, SESSION_WATERMARK_BASE, watermarkRows,
} from '../src/client/session-watermarks.ts'

const id = (value: string): SessionNode['id'] => `sess-${value}` as SessionNode['id']

const session = (value: string, patch: Partial<SessionNode> = {}): SessionNode => ({
  id: id(value),
  title: value,
  updatedAt: 1_000,
  blank: false,
  running: false,
  runningSubagentCount: 0,
  completed: false,
  archived: false,
  pinned: false,
  ...patch,
} as SessionNode)

describe('session watermarks', () => {
  it('shows the blank row plus five non-blank rows at baseline', () => {
    const sessions = [session('blank', { blank: true }), ...Array.from({ length: 8 }, (_, i) => session(String(i)))]
    expect(watermarkRows(sessions, SESSION_WATERMARK_BASE).rows.map(row => row.title))
      .toEqual(['blank', '0', '1', '2', '3', '4'])
  })

  it('raises the baseline through the last attention-bearing row within the automatic cap', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => session(String(i)))
    sessions[9] = session('9', { running: true })
    expect(requiredWatermark(sessions, undefined, undefined)).toBe(10)
  })

  it('does not raise beyond the cap by activity alone, but a search reveal still does', () => {
    const sessions = Array.from({ length: 60 }, (_, i) => session(String(i)))
    sessions[51] = session('51', { running: true })
    const browserBaseline = (
      rows: readonly SessionNode[],
      current: SessionNode['id'] | undefined,
      reveal: SessionNode['id'] | undefined,
    ) => Math.max(SESSION_WATERMARK_BASE, requiredWatermark(rows, current, reveal))
    expect(browserBaseline(sessions, undefined, undefined)).toBe(SESSION_WATERMARK_BASE)
    expect(browserBaseline(sessions, undefined, sessions[51]?.id)).toBe(52)
  })

  it('keeps stored marks identity-stable when no requirement rises', () => {
    const marks = { a: SESSION_WATERMARK_BASE }
    expect(raiseWatermarks(marks, [['a', SESSION_WATERMARK_BASE]])).toBe(marks)
  })

  it('merges only the raised groups into stored marks', () => {
    const marks = { a: 5, b: 7 }
    expect(raiseWatermarks(marks, [['a', 5], ['b', 9]])).toEqual({ a: 5, b: 9 })
  })
})
