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
import type { ReactNode } from 'react';
import type { WorkspaceBrowserProps } from '../contract/slots.ts';
import type { GroupNode } from '../tree.ts';
import type { ResolvedBadgeSettings } from '../badge-settings.ts';
export { groupBadgeIsUrgent, groupLiveLabel, hoverStatusLines, waitingReviewLabel } from '../badge-labels.ts';
/** The standard locale seat, prop-passed from the browser root. */
type RowTranslate = WorkspaceBrowserProps['t'];
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
export declare function groupLiveBadge(group: GroupNode, t: RowTranslate, settings: ResolvedBadgeSettings, now?: number): ReactNode;
//# sourceMappingURL=GroupBadge.d.ts.map