/**
 * Fork-owned: aggregated status badge for collapsed workspace groups.
 *
 * Extracted from `Rows.tsx` so the upstream diff surface is minimal — the
 * vendored file only needs one import and one `<GroupBadge />` call to wire
 * the badge in. Everything fork-specific lives here.
 *
 * The **wording** lives in `../badge-labels.ts`: this file imports the host icon set,
 * whose `require` graph only resolves inside the DSH app, so anything kept here is
 * untestable in this repository.
 *
 * 本文件也**不为任何具体状态源写分支**：外部来源的图标、色档、脉冲、文案都随 facet
 * 一起进来，这里只按登记顺序把它们排进徽标。
 *
 * @module
 */
import type { ReactNode } from 'react'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import type { GroupNode } from '../tree.ts'
import type { ResolvedBadgeSettings } from '../badge-settings.ts'
import { facetCountTotal, facetGlyph, groupBadgeIsUrgent, groupLiveLabel } from '../badge-labels.ts'
import css from './Rows.module.css'

export { facetCountTotal, facetGlyph, groupBadgeIsUrgent, groupLiveLabel, hoverStatusLines } from '../badge-labels.ts'

/** The standard locale seat, prop-passed from the browser root. */
type RowTranslate = WorkspaceBrowserProps['t']

// ── Badge ──

/**
 * Aggregated live-status badge for a folded folder row. Dots reuse StateDot so
 * colors match session rows (warning = pending, ongoing = running, done = completed).
 * Renders nothing while expanded or when nothing is pending/active/completed or any
 * status source reports a contribution.
 *
 * Count matches the dots: host-side sessions plus every registered facet's own count.
 *
 * `settings` 按来源过滤：关掉的来源不画点、不计数、不进 aria-label、不参与「是否显示
 * 徽标」的判断。会话行自身的状态点不受影响：那是行级状态，不是分组提示。**外部**来源的
 * 过滤发生在折叠之前（`WorkspaceBrowser` 按 `facet.settingKey` 筛登记面），所以到这里
 * 的折果已经是"该显示的"，label 与视觉不可能各说一套。
 *
 * `now` 缺省取渲染时刻（与 `WorkspaceBrowser` 为相对时间读的时钟同一姿态）：文案里的
 * 剩余时长以此计算，只在提供方 store 通知时随渲染更新。
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
  const completed = settings.showCompletedInBadge ? s.done : 0
  const facetTotal = facetCountTotal(s)
  // 只在有 pending / active / 已完成 / 任一外部来源有贡献时显示徽标
  if (pending === 0 && active === 0 && completed === 0 && facetTotal === 0) return null
  const label = groupLiveLabel(s, t, settings, now)
  const dots: ReactNode[] = []
  if (pending > 0) dots.push(<StateDot key="warn" state="warning" />)
  if (active > 0) dots.push(<StateDot key="run" state="ongoing" />)
  if (completed > 0) dots.push(<StateDot key="done" state="done" />)
  // 外部来源排在宿主状态点之后，顺序由 facet.order 决定（谁更该被看见，来源自己排）。
  for (const entry of s.facets.values()) {
    const glyph = facetGlyph(entry, t, now)
    dots.push(glyph === undefined
      // provider 没画图标时退回通用点：陌生来源仍然可见，只是朴素。宿主只有三档状态点，
      // 没有 error 档，所以 info 之外的色档都落到 warning 点上。
      ? <StateDot key={entry.facet.id} state={entry.fold.tone === 'info' ? 'ongoing' : 'warning'} />
      : <span key={entry.facet.id}>{glyph}</span>)
  }
  // 数字 = 待审批 + 进行中（含子智能体）+ 已完成 + 各外部来源自己报的条数。
  // P2-3: 上限 99+，避免大项目组徽标过宽。
  // P3-3: 低于 countThreshold 时省略数字（点已表达"有东西"）；设置项可调。
  const count = pending + active + completed + facetTotal
  const countLabel = count > 99 ? '99+' : count >= settings.countThreshold ? String(count) : ''
  // P2-2: 脉冲判据见 badge-labels.ts 的 groupBadgeIsUrgent（由各 facet 自己声明）。
  const badgeClass = groupBadgeIsUrgent(s) ? `${css.groupBadge} ${css.groupBadgeUrgent}` : css.groupBadge
  return (
    <span className={badgeClass} role="img" aria-label={label} title={label}>
      {dots}
      {countLabel && <span className={css.groupBadgeCount}>{countLabel}</span>}
    </span>
  )
}
