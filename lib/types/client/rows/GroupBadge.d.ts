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
import type { ReactNode } from 'react';
import type { WorkspaceBrowserProps } from '../contract/slots.ts';
import type { GroupNode } from '../tree.ts';
import type { ResolvedBadgeSettings } from '../badge-settings.ts';
export { facetCountTotal, facetGlyph, facetPulseClass, groupLiveLabel, hoverStatusLines } from '../badge-labels.ts';
/** The standard locale seat, prop-passed from the browser root. */
type RowTranslate = WorkspaceBrowserProps['t'];
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
export declare function groupLiveBadge(group: GroupNode, t: RowTranslate, settings: ResolvedBadgeSettings, now?: number): ReactNode;
//# sourceMappingURL=GroupBadge.d.ts.map