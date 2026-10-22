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
import { facetCountTotal, facetGlyph, facetPulseClass, groupLiveLabel } from '../badge-labels.ts'
import { BADGE_FIELD_DOT_STATE } from '../badge-field.ts'
import css from './Rows.module.css'

export { facetCountTotal, facetGlyph, facetPulseClass, groupLiveLabel, hoverStatusLines } from '../badge-labels.ts'

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
 * `settings` 只过滤**本插件自己的**三档会话状态：关掉的档位不画点、不计数、不进
 * aria-label、不参与「是否显示徽标」的判断。会话行自身的状态点不受影响：那是行级状态，
 * 不是分组提示。**外部来源在这里没有开关可关** —— 它们要么注册了（一定显示），要么没
 * 注册（根本不在登记面上）。要关某个来源，去那个插件自己的设置卡片：显隐是来源的决定。
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
  // 三枚点取自 `BADGE_FIELD_DOT_STATE`（与设置卡片里给每行画的预览点同一份）—— 两处各写
  // 一套的话，早晚漂成"卡片预览与徽标说的不是一回事"。
  if (pending > 0) dots.push(<StateDot key="warn" state={BADGE_FIELD_DOT_STATE.showPendingInBadge} />)
  if (active > 0) dots.push(<StateDot key="run" state={BADGE_FIELD_DOT_STATE.showRunningInBadge} />)
  // #25①:点行顺序此前是 pending → active → **done** → facet，而明细（`hoverStatusLines`）
  // 是 pending → active → **facet** → done，两处相反；而 `badge-labels.ts` 的注释声称两者
  // 「完全一致」，括号里写的还正是明细那一种。此处按明细对齐（facet 排在 done 之前），
  // 注释与实现从此同一条来源。
  // 外部来源的相对次序由 facet.order 决定（谁更该被看见，来源自己排）。
  // CSS module 的类型把 class 声明为可能 undefined，这里只在真的闪时才求值。
  const urgentClass = css.groupBadgeUrgent ?? ''
  for (const entry of s.facets.values()) {
    const glyph = facetGlyph(entry, t, now)
    const pulseClass = facetPulseClass(entry, urgentClass) || undefined
    dots.push(glyph === undefined
      // provider 没画图标时退回通用点：陌生来源仍然可见，只是朴素。宿主只有三档状态点，
      // 没有 error 档，所以 info 之外的色档都落到 warning 点上。
      ? <StateDot key={entry.facet.id} state={entry.fold.tone === 'info' ? 'ongoing' : 'warning'} />
      // #22:脉冲 class 加在**这一枚元素**上，不是整只徽标。同组里别家开闪不该让
      // `pulse: false` 的来源跟着呼吸——那条约定不能依赖邻居的开关。
      : <span key={entry.facet.id} className={pulseClass}>{glyph}</span>)
  }
  if (completed > 0) dots.push(<StateDot key="done" state={BADGE_FIELD_DOT_STATE.showCompletedInBadge} />)
  // 数字 = 待审批 + 进行中（含子智能体）+ 已完成 + 各外部来源自己报的条数。
  // #25②:「含子智能体」此前是**空头承诺**——`summarizeGroupStatus` 在 pending 分支里
  //  `continue` 掉了 `subagents += n.runningSubagentCount`，行内却给两个点。计数判据已
  //  改成与 `Rows.tsx` 的 `sessionStatuses()` 同一套规则，这条注释现在才成立。
  // P2-3: 上限 99+，避免大项目组徽标过宽。
  // P3-3: 低于 countThreshold 时省略数字（点已表达"有东西"）；设置项可调。
  const count = pending + active + completed + facetTotal
  const countLabel = count > 99 ? '99+' : count >= settings.countThreshold ? String(count) : ''
  // #22:徽标**容器**不再带脉冲 class——脉冲是"某个来源的元素该闪"，不是整只徽标该闪。
  return (
    <span className={css.groupBadge} role="img" aria-label={label} title={label}>
      {dots}
      {countLabel && <span className={css.groupBadgeCount}>{countLabel}</span>}
    </span>
  )
}
