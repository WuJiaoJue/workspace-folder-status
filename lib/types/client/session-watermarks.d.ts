/** Non-blank Session rows visible per Workspace while no Session raises its watermark. */
export declare const SESSION_WATERMARK_BASE = 5;
/** Highest watermark that attention-bearing Sessions raise automatically; Show more and search reveals may exceed it. */
export declare const SESSION_WATERMARK_AUTO_MAX = 50;
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionNode } from './tree.ts';
/** The blank row plus the first `watermark` non-blank rows, in list order. */
export declare function watermarkRows(sessions: readonly SessionNode[], watermark: number): {
    /** The rows this watermark makes visible. */
    rows: readonly SessionNode[];
    /** Non-blank rows beyond the watermark, capped by the row list's own hidden accounting. */
    hiddenCount: number;
};
/**
 * Smallest watermark that covers every non-blank row within the automatic maximum that is running, has a running
 * child, awaits the user, carries an unread completion, or is current, and the reveal target at any position.
 * @param sessions - one group's ordered Session rows.
 * @param current - Session retained by the main view, if the sidebar is the active surface.
 * @param revealSessionId - Session selected from search and required to be visible.
 * @returns the group's baseline non-blank row count.
 */
export declare function requiredWatermark(sessions: readonly SessionNode[], current: SessionId | undefined, revealSessionId: SessionId | undefined): number;
/**
 * Raise each listed group's watermark to its requirement; returns `marks` itself when nothing rises.
 * @param marks - watermarks stored by the current browser tree.
 * @param required - required baselines, in group order.
 * @returns either the unchanged input or a new object containing only raised groups.
 */
export declare function raiseWatermarks(marks: Readonly<Record<string, number>>, required: Iterable<readonly [string, number]>): Readonly<Record<string, number>>;
//# sourceMappingURL=session-watermarks.d.ts.map