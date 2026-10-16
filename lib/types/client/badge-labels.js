const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
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
export function waitingReviewLabel(s, t, now) {
    if (s.waitingReviewState === 'overdue')
        return t('status.waitingReviewOverdue');
    const deadline = s.waitingReviewNextDeadline;
    if (deadline === undefined)
        return t('status.waitingReview');
    const left = Math.max(0, deadline - now);
    if (left < MINUTE_MS)
        return t('status.waitingReviewImminent');
    if (left < HOUR_MS) {
        return t('status.waitingReviewLeft', { time: t('time.minutes', { n: Math.floor(left / MINUTE_MS) }) });
    }
    return t('status.waitingReviewLeft', { time: t('time.hours', { n: Math.floor(left / HOUR_MS) }) });
}
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
export function groupBadgeIsUrgent(s) {
    return s.scheduleState === 'overdue' || s.scheduleState === 'urgent';
}
/** `#15, #2783`: the distinct PR numbers a group waits on, ascending.
 *
 * De-duplicated and sorted here rather than in the fold: the publisher's own aggregator
 * lists one PR **per waiting member**, so two members waiting on the same PR legitimately
 * arrive as two entries, and only this display seat knows it must read as one `#15`.
 *
 * Capped at three: a folder spanning many PRs would otherwise push the rest of the label
 * out of the tooltip, and the count in front already says how many members are waiting.
 */
function prNumberList(prNumbers) {
    if (prNumbers === undefined || prNumbers.length === 0)
        return '';
    const distinct = [...new Set(prNumbers)].sort((a, b) => a - b);
    const shown = distinct.slice(0, 3).map(pr => `#${pr}`);
    if (distinct.length > shown.length)
        shown.push(`+${distinct.length - shown.length}`);
    return shown.join(', ');
}
/**
 * Append the PR numbers to a phrase: `等待评审（剩 3分钟） · #15`.
 *
 * No locale key: `#15` is a number and ` · ` is the separator these labels already
 * use, so a translation seat would only invite drift.
 */
function withPrNumbers(phrase, prNumbers) {
    const list = prNumberList(prNumbers);
    return list === '' ? phrase : `${phrase} · ${list}`;
}
/**
 * Accessible label for a folded group's aggregated status, reusing the session-row
 * locale keys so both surfaces read identically.
 *
 * 按设置过滤：关掉的来源不出现在标签里（aria-label 与徽标视觉一致）。
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
    if (settings.showWaitingReviewInBadge && s.waitingReviewCount > 0) {
        parts.push(`${s.waitingReviewCount} ${withPrNumbers(waitingReviewLabel(s, t, now), s.waitingReviewPrNumbers)}`);
    }
    if (settings.showScheduledInBadge && s.scheduledSessions > 0)
        parts.push(`${s.scheduledSessions} ${t('status.scheduled')}`);
    if (settings.showCompletedInBadge && s.done > 0)
        parts.push(`${s.done} ${t('status.completed')}`);
    return parts.join(' · ');
}
/**
 * Build the status detail lines for the workspace hover card.
 *
 * Extracted so `WorkspaceHoverContent` in `Rows.tsx` only needs to map the returned
 * array; the fork-specific status→line logic lives here.
 *
 * 按设置过滤：关掉的来源不出现在明细行里；`showHoverDetails=false` 时整段返回空。
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
    if (settings.showWaitingReviewInBadge && status.waitingReviewCount > 0) {
        // 明细行是"说清楚"的地方：状态、还剩多久、以及**在等哪个 PR**，三样都是
        // dsh-gitea-dispatch 已经发布过的字段（`state` / `deadline` / `prNumber`）。
        lines.push({
            state: 'warning',
            text: `${status.waitingReviewCount} ${withPrNumbers(waitingReviewLabel(status, t, now), status.waitingReviewPrNumbers)}`,
        });
    }
    if (settings.showScheduledInBadge && status.scheduledSessions > 0) {
        lines.push({ state: 'warning', text: `${status.scheduledSessions} ${t('status.scheduled')}` });
    }
    if (settings.showCompletedInBadge && status.done > 0)
        lines.push({ state: 'done', text: `${status.done} ${t('status.completed')}` });
    return lines;
}
//# sourceMappingURL=badge-labels.js.map