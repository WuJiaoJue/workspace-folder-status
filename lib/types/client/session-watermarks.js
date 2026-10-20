/** Non-blank Session rows visible per Workspace while no Session raises its watermark. */
export const SESSION_WATERMARK_BASE = 5;
/** Highest watermark that attention-bearing Sessions raise automatically; Show more and search reveals may exceed it. */
export const SESSION_WATERMARK_AUTO_MAX = 50;
/** The blank row plus the first `watermark` non-blank rows, in list order. */
export function watermarkRows(sessions, watermark) {
    let count = 0;
    const rows = sessions.filter((session) => {
        if (session.blank)
            return true;
        count += 1;
        return count <= watermark;
    });
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
    let raised = marks;
    for (const [key, watermark] of required) {
        if (watermark > (raised[key] ?? SESSION_WATERMARK_BASE)) {
            raised = { ...raised, [key]: watermark };
        }
    }
    return raised;
}
//# sourceMappingURL=session-watermarks.js.map