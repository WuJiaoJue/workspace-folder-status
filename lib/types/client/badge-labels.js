/**
 * 把侧栏行的翻译位交给 facet。
 *
 * 这里有一次**故意的放宽**：协议的 `t` 收任意字符串键，而行位只收本插件 `workspace`
 * 命名空间的键。放宽是安全的——宿主 locale 服务对未注册的键一律**原样回显键名**（不是
 * 抛错），所以外来 facet 传了自己命名空间的键，最坏读出的是那串键名而不是崩渲染。
 * 要正确本地化，provider 应当闭包自己的翻译函数、忽略这里传入的 `t`。
 */
function asFacetTranslate(t) {
    return (key, options) => t(key, options);
}
/** 该 facet 贡献进徽标数字的条数。 */
export function facetCountTotal(s) {
    let total = 0;
    for (const entry of s.facets.values())
        total += entry.fold.count;
    return total;
}
/**
 * 每个外部状态来源的那句话，按登记顺序。
 *
 * facet 没实现 `label` 时**不能**退化成 `2 dsh-later.schedule` 这种读法，所以给一句
 * 通用措辞兜底：只说有几个来源在响，具体语义等该来源自己补文案。
 */
export function facetLines(s, t, now) {
    const translate = asFacetTranslate(t);
    const lines = [];
    for (const entry of s.facets.values()) {
        const text = entry.facet.label?.(entry.fold, { now, t: translate });
        lines.push(text === undefined || text === '' ? `${entry.fold.count} ${t('status.needsAttention')}` : text);
    }
    return lines;
}
/**
 * Accessible label for a folded group's aggregated status, reusing the
 * session-row locale keys so both surfaces read identically.
 *
 * 按设置过滤：**关掉的外部来源根本不在折果里**（`WorkspaceBrowser` 折叠前就按
 * `facet.settingKey` 过滤了登记面），所以这里不必再判设置，`aria-label` 与徽标视觉
 * 天然一致；宿主的行级状态仍按设置逐项过滤。
 */
export function groupLiveLabel(s, t, settings, now = Date.now()) {
    const parts = [];
    if (settings.showPendingInBadge) {
        if (s.approval > 0)
            parts.push(`${s.approval} ${t('status.waitingApproval')}`);
        if (s.planReview > 0)
            parts.push(`${s.planReview} ${t('status.planReview')}`);
        if (s.question > 0)
            parts.push(`${s.question} ${t('status.waitingAnswer')}`);
    }
    if (settings.showRunningInBadge) {
        if (s.running > 0)
            parts.push(`${s.running} ${t('status.running')}`);
        if (s.subagents > 0) {
            parts.push(t(s.subagents === 1 ? 'status.subagentsRunning.one' : 'status.subagentsRunning.other', { n: s.subagents }));
        }
    }
    parts.push(...facetLines(s, t, now));
    if (settings.showCompletedInBadge && s.done > 0)
        parts.push(`${s.done} ${t('status.completed')}`);
    return parts.join(' · ');
}
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
export function hoverStatusLines(status, t, settings, now = Date.now()) {
    const lines = [];
    if (status === undefined || !settings.showHoverDetails)
        return lines;
    if (settings.showPendingInBadge) {
        if (status.approval > 0)
            lines.push({ state: 'warning', text: `${status.approval} ${t('status.waitingApproval')}` });
        if (status.planReview > 0)
            lines.push({ state: 'warning', text: `${status.planReview} ${t('status.planReview')}` });
        if (status.question > 0)
            lines.push({ state: 'warning', text: `${status.question} ${t('status.waitingAnswer')}` });
    }
    if (settings.showRunningInBadge) {
        if (status.running > 0)
            lines.push({ state: 'ongoing', text: `${status.running} ${t('status.running')}` });
        if (status.subagents > 0) {
            lines.push({
                state: 'ongoing',
                text: t(status.subagents === 1 ? 'status.subagentsRunning.one' : 'status.subagentsRunning.other', { n: status.subagents }),
            });
        }
    }
    // 宿主的状态点只有 warning / ongoing / done 三档，没有 error 档；外部来源的紧急程度
    // 因此由**文案与图标色**表达（两者都归来源自己），明细点统一用 warning。
    for (const text of facetLines(status, t, now))
        lines.push({ state: 'warning', text });
    if (settings.showCompletedInBadge && status.done > 0)
        lines.push({ state: 'done', text: `${status.done} ${t('status.completed')}` });
    return lines;
}
/**
 * 徽标要不要脉冲。
 *
 * 由**折果自己**声明（`FacetFold.pulse`），本插件不再按状态名反推。这条判据曾经写死在
 * 这里：定时任务 overdue/urgent 闪，等待评审 overdue 也闪。后者是错的——dsh-gitea-dispatch
 * 把 `overdue` 画成**静止**（其 `lib/waiting-glyph.js`：「超时后停动画：静止即不再期待」），
 * 且它只代表 CI 窗口到期、不代表评审失败。同一条等待在行内静止、在父级闪动，就是同一
 * 事实的两种说法。现在这类判断随状态语义一起留在它的所有者那一侧。
 */
export function groupBadgeIsUrgent(s) {
    for (const entry of s.facets.values()) {
        if (entry.fold.pulse)
            return true;
    }
    return false;
}
/**
 * 一个来源的图标。
 *
 * 归 provider 画（`facet.renderIcon`）：「这个状态长什么样」是它的知识。没实现时本插件
 * 按色档退回一个通用点（见 `rows/GroupBadge.tsx`），保证陌生来源仍然可见、只是朴素。
 */
export function facetGlyph(entry, t, now) {
    return entry.facet.renderIcon?.(entry.fold, { now, t: asFacetTranslate(t) });
}
//# sourceMappingURL=badge-labels.js.map