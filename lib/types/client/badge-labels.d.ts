/**
 * Fork-owned: the **wording** of a folded group's aggregated status.
 *
 * Split out of `rows/GroupBadge.tsx` for one concrete reason: that file imports the
 * host icon set, and a published `…/client` bundle's `require` graph only resolves
 * inside the DSH app (see `vitest.config.ts`, exclusion reason (b)). Keeping these
 * functions free of runtime imports is what lets the badge behaviour be tested at all
 * instead of being asserted by a screenshot nobody re-runs.
 *
 * 本模块**不认识任何具体状态源**：外部状态一律经 `./facets.ts` 的协议进来，文案、图标、
 * 脉冲都由该状态的所有者声明，本模块只管排布顺序与分隔符。
 *
 * @module
 */
import type { ReactNode } from 'react';
import type { WorkspaceBrowserProps } from './contract/slots.ts';
import type { FacetEntry, GroupLiveStatus } from './group-status.ts';
import type { ResolvedBadgeSettings } from './badge-settings.ts';
/** The standard locale seat, prop-passed from the browser root (type-only import). */
type RowTranslate = WorkspaceBrowserProps['t'];
/** 一条悬停明细：一个状态点加它的文案。 */
export interface HoverStatusLine {
    state: 'warning' | 'ongoing' | 'done';
    text: string;
}
/** 该 facet 贡献进徽标数字的条数。 */
export declare function facetCountTotal(s: GroupLiveStatus): number;
/**
 * 每个外部状态来源的那句话，按登记顺序。
 *
 * facet 没实现 `label` 时**不能**退化成 `2 dsh-later.schedule` 这种读法，所以给一句
 * 通用措辞兜底：只说有几个来源在响，具体语义等该来源自己补文案。
 */
export declare function facetLines(s: GroupLiveStatus, t: RowTranslate, now: number): string[];
/**
 * Accessible label for a folded group's aggregated status, reusing the
 * session-row locale keys so both surfaces read identically.
 *
 * 按设置过滤：**关掉的外部来源根本不在折果里**（`WorkspaceBrowser` 折叠前就按
 * `facet.settingKey` 过滤了登记面），所以这里不必再判设置，`aria-label` 与徽标视觉
 * 天然一致；宿主的行级状态仍按设置逐项过滤。
 */
export declare function groupLiveLabel(s: GroupLiveStatus, t: RowTranslate, settings: ResolvedBadgeSettings, now?: number): string;
/**
 * Build the status detail lines for the workspace hover card.
 *
 * Extracted so `WorkspaceHoverContent` in `Rows.tsx` only needs to map the returned
 * array — the fork-specific status→line logic lives here.
 *
 * 按设置过滤：关掉的来源不出现在明细行里；`showHoverDetails=false` 时整段返回空。
 * 明细行的顺序与徽标**完全一致**（外部来源排在会话状态之后、已完成之前）：两处顺序
 * 不一样会让人怀疑它们是两套事实。
 */
export declare function hoverStatusLines(status: GroupLiveStatus | undefined, t: RowTranslate, settings: ResolvedBadgeSettings, now?: number): HoverStatusLine[];
/**
 * 徽标要不要脉冲。
 *
 * 由**折果自己**声明（`FacetFold.pulse`），本插件不再按状态名反推。这条判据曾经写死在
 * 这里：定时任务 overdue/urgent 闪，等待评审 overdue 也闪。后者是错的——dsh-gitea-dispatch
 * 把 `overdue` 画成**静止**（其 `lib/waiting-glyph.js`：「超时后停动画：静止即不再期待」），
 * 且它只代表 CI 窗口到期、不代表评审失败。同一条等待在行内静止、在父级闪动，就是同一
 * 事实的两种说法。现在这类判断随状态语义一起留在它的所有者那一侧。
 */
export declare function groupBadgeIsUrgent(s: GroupLiveStatus): boolean;
/**
 * 一个来源的图标。
 *
 * 归 provider 画（`facet.renderIcon`）：「这个状态长什么样」是它的知识。没实现时本插件
 * 按色档退回一个通用点（见 `rows/GroupBadge.tsx`），保证陌生来源仍然可见、只是朴素。
 */
export declare function facetGlyph(entry: FacetEntry, t: RowTranslate, now: number): ReactNode;
export {};
//# sourceMappingURL=badge-labels.d.ts.map