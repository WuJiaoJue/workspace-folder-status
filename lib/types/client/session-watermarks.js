/** Non-blank Session rows visible per Workspace while no Session raises its watermark. */
export const SESSION_WATERMARK_BASE = 5;
/** Highest watermark that attention-bearing Sessions raise automatically; Show more and search reveals may exceed it. */
export const SESSION_WATERMARK_AUTO_MAX = 50;
/**
 * The blank row plus the first `watermark` non-blank rows, in list order.
 * @param sessions - one group's rows, whose blank placeholder(s) lead the list
 *   (`sectionMembers` puts every blank session ahead of the pinned/ordinary partitions).
 * @param watermark - highest non-blank row index that stays visible; `0` keeps only blank rows.
 */
export function watermarkRows(sessions, watermark) {
    const rows = [];
    let count = 0;
    for (const session of sessions) {
        if (session.blank) {
            rows.push(session);
            continue;
        }
        // Early exit on the first kept-out row: blanks always lead the list, so nothing after the
        // cut can be visible and the tail no longer has to be walked (this replaced a full filter
        // over every session row — the watermark is usually far smaller than the list).
        if (count >= watermark)
            break;
        count += 1;
        rows.push(session);
    }
    return { rows, hiddenCount: sessions.length - rows.length };
}
/**
 * Smallest watermark that covers every non-blank row within the automatic maximum that is running, has a running
 * child, awaits the user, carries an unread completion, or is current, and the reveal target at any position.
 * @param sessions - one group's ordered Session rows.
 * @param current - Session retained by the main view, if the sidebar is the active surface.
 * @param revealSessionId - Session selected from search and required to be visible.
 * @returns the group's baseline non-blank row count.
 */
export function requiredWatermark(sessions, current, revealSessionId) {
    let index = 0;
    let required = 0;
    for (const session of sessions) {
        if (session.blank)
            continue;
        index += 1;
        if ((index <= SESSION_WATERMARK_AUTO_MAX
            && (session.running || session.runningSubagentCount > 0
                || session.pendingInteraction !== undefined || session.completed || session.id === current))
            || session.id === revealSessionId)
            required = index;
    }
    return required;
}
/**
 * Raise each listed group's watermark to its requirement; returns `marks` itself when nothing rises.
 * @param marks - watermarks stored by the current browser tree.
 * @param required - required baselines, in group order.
 * @returns either the unchanged input or a new object containing only raised groups.
 */
export function raiseWatermarks(marks, required) {
    let raised;
    for (const [key, watermark] of required) {
        // Compare against the copy once it exists, so a repeated key sees the value raised earlier
        // in this same pass (`marks` itself is never written).
        const current = raised ?? marks;
        if (watermark <= (current[key] ?? SESSION_WATERMARK_BASE))
            continue;
        // One spread for the whole pass, not one per raised group: the shape of the result is
        // "input plus whichever groups rose", so the object is copied on the first raise and then
        // built up in place.
        raised ??= { ...marks };
        raised[key] = watermark;
    }
    return raised ?? marks;
}
//# sourceMappingURL=session-watermarks.js.map