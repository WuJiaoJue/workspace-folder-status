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
 * 每个外部状态来源的明细行，**带它自己的图标**（#24）。
 *
 * 徽标侧画的是 provider 交出的、已含色档的元素（`rows/GroupBadge.tsx` 的 `facetGlyph`），
 * 明细侧此前只画一个统一的 `StateDot`，于是同一条状态、同一次悬停里，徽标是红色沙漏、
 * 明细是黄点——同一行的两个视图各说一套。宿主 `StateDot` 只有 warning / ongoing / done
 * 三档、没有 error 档，所以色档**只能**由来源自己的图标表达，这也是本函数存在的理由。
 *
 * provider 没交图标时退回通用点（与徽标侧同一套兜底），陌生来源仍然可见。
 *
 * @returns 明细行；`glyph` 为 `undefined` 表示该行用 `StateDot` 渲染。
 */
export function facetDetailLines(s, t, now) {
    const translate = asFacetTranslate(t);
    const lines = [];
    for (const entry of s.facets.values()) {
        const raw = entry.facet.label?.(entry.fold, { now, t: translate });
        const text = raw === undefined || raw === '' ? `${entry.fold.count} ${t('status.needsAttention')}` : raw;
        lines.push({ state: 'warning', text, glyph: facetGlyph(entry, t, now) });
    }
    return lines;
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
    // #24:外部来源的明细行改用来源自己的图标（已含色档），与徽标同源。宿主的三档点仍用在
    // 宿主会话状态上——那些档位本就是宿主的语义，色档无处可失。
    lines.push(...facetDetailLines(status, t, now));
    if (settings.showCompletedInBadge && status.done > 0)
        lines.push({ state: 'done', text: `${status.done} ${t('status.completed')}` });
    return lines;
}
/**
 * 某一条外部来源的元素该带哪只 class（#22）。
 *
 * 脉冲判据仍由各 facet 自己声明（`FacetFold.pulse`），但**作用对象必须下沉到声明它的那个
 * 元素**。此前 `groupBadgeIsUrgent()` 只返回一个整徽标的布尔值、class 加在容器上，于是同组
 * 里任何一家声明 `pulse: true` 都会让别家本该静止的图标跟着呼吸：`pulse: false` 是否生效，
 * 取决于同组里恰好有没有别人开了闪。判断交出去了，作用对象没交出去——这是修过一次的回归
 * （见下）。
 *
 * 保留这条历史的原因写在所有者那边：dsh-gitea-dispatch 把 `overdue` 画成**静止**（其
 * `lib/waiting-glyph.js`：「超时后停动画：静止即不再期待」），且它只代表 CI 窗口到期、
 * 不代表评审失败。同一条等待在行内静止、在父级闪动，就是同一事实的两种说法。
 */
export function facetPulseClass(entry, urgentClass) {
    return entry.fold.pulse ? urgentClass : undefined;
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