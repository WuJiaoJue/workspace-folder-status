/**
 * Fork-owned: the **wording** of a folded group's aggregated status.
 *
 * Split out of `rows/GroupBadge.tsx` for one concrete reason: that file imports the
 * host icon set, and a published `…/client` bundle's `require` graph only resolves
 * inside the DSH app (see `vitest.config.ts`, exclusion reason (b)). Keeping these
 * functions free of runtime imports is what lets the locale behaviour the badge
 * depends on (including the cross-plugin states below) be tested at all instead of
 * being asserted by a screenshot nobody re-runs.
 *
 * @module
 */
import type { WorkspaceBrowserProps } from './contract/slots.ts';
import type { GroupLiveStatus } from './group-status.ts';
import type { ResolvedBadgeSettings } from './badge-settings.ts';
/** The standard locale seat, prop-passed from the browser root (type-only import). */
type RowTranslate = WorkspaceBrowserProps['t'];
/**
 * The waiting-review phrase, carrying the state and, when there is one, the
 * countdown, mirroring how dsh-gitea-dispatch words its own row presence
 * (`等待评审 3:28` / `评审等待已超时` / `等待评审结果`).
 *
 * The version before this one said `等待评审` for **every** state, so `waiting` and
 * `overdue` differed by colour alone, the very thing `GroupBadge.tsx` rules out for
 * colour-blind users when it picks a different *icon* per source, and it threw away
 * the distinction the publisher bothers to compute and publish.
 *
 * Deliberately minute-granular: the badge re-renders when the publisher's store
 * notifies (its 15s poll plus the exact deadline tick), so a second-precise figure
 * would sit frozen between those ticks and lie. Minutes stay true, and the publisher
 * flips the state itself the moment the window lapses.
 */
export declare function waitingReviewLabel(s: GroupLiveStatus, t: RowTranslate, now: number): string;
/**
 * Whether a folded group's badge should pulse.
 *
 * ⚠️ Scheduled reminders only, **never** a waiting-review `overdue`. That is the data
 * owner's semantics, not a taste call: dsh-gitea-dispatch draws `overdue` **statically**
 * (`lib/waiting-glyph.js`: "超时后停动画：静止即'不再期待'，比继续闪动更能表达'已经结束'")
 * and its docs define `overdue` as *CI's wait window lapsed*, explicitly not a failed
 * review: the review is often still running. Pulsing a folder the same plugin's session
 * row renders as still would state the same fact two ways.
 *
 * The red colour stays (the publisher's own `overdue` colour too); the state itself is now
 * carried by the wording, so nothing is lost by dropping the animation.
 */
export declare function groupBadgeIsUrgent(s: GroupLiveStatus): boolean;
/**
 * Accessible label for a folded group's aggregated status, reusing the session-row
 * locale keys so both surfaces read identically.
 *
 * 按设置过滤：关掉的来源不出现在标签里（aria-label 与徽标视觉一致）。
 */
export declare function groupLiveLabel(s: GroupLiveStatus, t: RowTranslate, settings: ResolvedBadgeSettings, now?: number): string;
/** One hover-card line: a state dot plus its text. */
export interface HoverStatusLine {
    state: 'warning' | 'ongoing' | 'done';
    text: string;
}
/**
 * Build the status detail lines for the workspace hover card.
 *
 * Extracted so `WorkspaceHoverContent` in `Rows.tsx` only needs to map the returned
 * array; the fork-specific status→line logic lives here.
 *
 * 按设置过滤：关掉的来源不出现在明细行里；`showHoverDetails=false` 时整段返回空。
 */
export declare function hoverStatusLines(status: GroupLiveStatus | undefined, t: RowTranslate, settings: ResolvedBadgeSettings, now?: number): HoverStatusLine[];
export {};
//# sourceMappingURL=badge-labels.d.ts.map