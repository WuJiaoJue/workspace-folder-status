/**
 * Fork-owned: aggregated status badge for collapsed workspace groups.
 *
 * Extracted from `Rows.tsx` so the upstream diff surface is minimal — the
 * vendored file only needs one import and one `<GroupBadge />` call to wire
 * the badge in. Everything fork-specific lives here.
 *
 * The **wording** (label and hover lines) lives in `../badge-labels.ts`: this file
 * imports the host icon set, which resolves to a closure bundle whose `require` graph
 * only exists inside the DSH app, so anything kept here is untestable in this repo.
 * Cross-plugin states are exactly what must stay testable.
 *
 * @module
 */
import type { ReactNode } from 'react'
import {
  IconClockOutlineRegular, IconListPenOutlineRegular, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import type { GroupNode } from '../tree.ts'
import type { ResolvedBadgeSettings } from '../badge-settings.ts'
import { groupBadgeIsUrgent, groupLiveLabel } from '../badge-labels.ts'
import css from './Rows.module.css'

export { groupBadgeIsUrgent, groupLiveLabel, hoverStatusLines, waitingReviewLabel } from '../badge-labels.ts'

/** The standard locale seat, prop-passed from the browser root. */
type RowTranslate = WorkspaceBrowserProps['t']

// ── Badge ──

/**
 * Aggregated live-status badge for a folded folder row. Dots reuse StateDot so
 * colors match session rows (warning = pending, ongoing = running, done = completed).
 * Renders nothing while expanded or when nothing is pending/active/completed/scheduled/waiting.
 *
 * Count matches the dots: pending + active + completed + waiting-review + scheduled sessions.
 *
 * `settings` 按来源过滤：关掉的来源不画点、不计数、不进 aria-label、不参与「是否显示徽标」
 * 的判断。会话行自身的状态不受影响：那是行级状态，不是分组提示。
 *
 * `now` 缺省取渲染时刻（与 `WorkspaceBrowser` 自己为相对时间读的时钟同一姿态）：
 * 等待评审的剩余时长以此计算，故只在提供方 store 通知时随渲染更新。
 */
export function groupLiveBadge(
  group: GroupNode,
  t: RowTranslate,
  settings: ResolvedBadgeSettings,
  now: number = Date.now(),
): ReactNode {
  const s = group.liveStatus
  if (group.expanded || s === undefined) return null
  const pending = settings.showPendingInBadge ? s.approval + s.planReview + s.question : 0
  const active = settings.showRunningInBadge ? s.running + s.subagents : 0
  const scheduled = settings.showScheduledInBadge ? s.scheduledSessions : 0
  const hasWaitingReview = settings.showWaitingReviewInBadge && s.waitingReviewCount > 0
  const completed = settings.showCompletedInBadge ? s.done : 0
  // 只在有 pending / active / 已完成 / 定时任务 / 等待评审时显示徽标
  if (pending === 0 && active === 0 && completed === 0 && scheduled === 0 && !hasWaitingReview) return null
  const label = groupLiveLabel(s, t, settings, now)
  const dots: ReactNode[] = []
  if (pending > 0) dots.push(<StateDot key="warn" state="warning" />)
  if (active > 0) dots.push(<StateDot key="run" state="ongoing" />)
  if (completed > 0) dots.push(<StateDot key="done" state="done" />)
  // 定时任务图标（紫色 #8b5cf6 与 dsh-later 定时徽标同源，浅深底对比均 >=3:1；
  // urgent 橙 / overdue 红走宿主 warn/error 语义令牌）。与等待评审**用不同图标**——
  // 两者同属"在等"的语义，只靠颜色区分对色盲用户不可用。
  if (scheduled > 0) {
    const stateColor = s.scheduleState === 'overdue' ? 'var(--dsw-alias-state-error-primary)' : s.scheduleState === 'urgent' ? 'var(--dsw-alias-state-warn-secondary)' : '#8b5cf6'
    dots.push(
      <span key="schedule" style={{ color: stateColor, display: 'inline-flex', alignItems: 'center' }}>
        <IconClockOutlineRegular size={14} />
      </span>,
    )
  }
  // 等待评审图标（琥珀色；超时转红）。数据来自 dsh-gitea-dispatch 的
  // useWaitingSummary()——本插件不自己轮询该端点（其 store 是唯一轮询方）。
  if (hasWaitingReview) {
    const stateColor = s.waitingReviewState === 'overdue' ? 'var(--dsw-alias-state-error-primary)' : 'var(--dsw-alias-state-warn-secondary)'
    dots.push(
      <span key="waiting-review" style={{ color: stateColor, display: 'inline-flex', alignItems: 'center' }}>
        <IconListPenOutlineRegular size={14} />
      </span>,
    )
  }
  // 数字统计 pending + active + 已完成 + 定时任务会话 + 等待评审会话（与 dot 一致）
  // P2-3: 数字上限 99+，避免大项目组徽标过宽。
  // P3-3: count < countThreshold 时省略数字（点已表达"有东西"）；设置项 countThreshold 可调。
  const count = pending + active + completed + scheduled + (hasWaitingReview ? s.waitingReviewCount : 0)
  const countLabel = count > 99 ? '99+' : count >= settings.countThreshold ? String(count) : ''
  // P2-2: 紧急状态时脉冲。判据在 badge-labels.ts 里（可测），只给定时任务的
  // overdue/urgent；等待评审的 overdue 由提供方画成**静止**，本徽标跟随。
  const isUrgent = groupBadgeIsUrgent(s)
  const badgeClass = isUrgent ? `${css.groupBadge} ${css.groupBadgeUrgent}` : css.groupBadge
  return (
    <span className={badgeClass} role="img" aria-label={label} title={label}>
      {dots}
      {countLabel && <span className={css.groupBadgeCount}>{countLabel}</span>}
    </span>
  )
}
