/**
 * Row-surface scaffolding shared by the browser shell and its three list bodies:
 * the search wire constants, the drag state machine's types and helpers, and the
 * prop contract the tree body exposes to the flat and search bodies.
 *
 * 从 `WorkspaceBrowser.tsx` 拆出的**无状态**部分：只有类型、常量与纯函数，没有组件。
 * 三个列表体与 shell 都从这里取件，因此它们之间不必互相 import，也就不会成环。
 */
import { useEffect } from 'react';
import { pinCurrentBlank } from "../tree.js";
/**
 * Column slide length (--ds-transition-duration-slow): rail-search focus waits it out —
 * focus() forces a synchronous layout and would jank the slide.
 */
export const EXPAND_SLIDE_MS = 300;
/** Pause between the latest keystroke and a Host content-search request. */
export const SEARCH_DEBOUNCE_MS = 250;
/** `session.search` wire bound, measured in JavaScript UTF-16 code units. */
export const SEARCH_QUERY_MAX_CODE_UNITS = 500;
/** Keep controlled input and RPC payload inside the session.search wire contract. */
export function sanitizeSearchQuery(value) {
    const withoutNul = value.replaceAll('\0', '');
    if (withoutNul.length <= SEARCH_QUERY_MAX_CODE_UNITS)
        return withoutNul;
    let end = SEARCH_QUERY_MAX_CODE_UNITS;
    const last = withoutNul.charCodeAt(end - 1);
    const next = withoutNul.charCodeAt(end);
    if (last >= 0xD800 && last <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF)
        end--;
    return withoutNul.slice(0, end);
}
/**
 * Accept the native drag at document level while a row drag is active: row
 * hover still owns the insertion marker, and releasing outside the list must
 * not be rendered as a rejected drop before dragend commits that last marker.
 */
export function useNativeDragAcceptance(active) {
    useEffect(() => {
        if (!active)
            return;
        const acceptDrag = (event) => {
            event.preventDefault();
            if (event.dataTransfer !== null)
                event.dataTransfer.dropEffect = 'move';
        };
        const acceptDrop = (event) => { event.preventDefault(); };
        document.addEventListener('dragover', acceptDrag);
        document.addEventListener('drop', acceptDrop);
        return () => {
            document.removeEventListener('dragover', acceptDrag);
            document.removeEventListener('drop', acceptDrop);
        };
    }, [active]);
}
/** Apply a visible drop to the complete account without removing hidden members. */
export function sessionDragOrder(order, rows, drag, over) {
    const source = rows.find(row => row.id === drag.sessionId);
    const target = rows.find(row => row.id === over.id);
    if (source === undefined || target === undefined || source.blank
        || source.pinned !== drag.pinned || target.pinned !== drag.pinned
        || source.id === target.id || !order.includes(source.id))
        return;
    const section = rows.filter(row => row.pinned === drag.pinned);
    const sourceIndex = section.findIndex(row => row.id === source.id);
    const withoutSource = section.filter(row => row.id !== source.id);
    const insertAt = withoutSource.findIndex(row => row.id === target.id) + (over.half === 'after' ? 1 : 0);
    if (insertAt === sourceIndex)
        return;
    const next = order.filter(id => id !== source.id);
    const targetIndex = next.indexOf(target.id);
    if (targetIndex === -1)
        return;
    next.splice(targetIndex + (over.half === 'after' ? 1 : 0), 0, source.id);
    return pinCurrentBlank(next, rows.find(row => row.blank)?.id);
}
/** Resolve an insertion side across the Workspace header, descendants, and Sessions. */
export function workspaceGroupHalf(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}
/**
 * Session the main view currently retains, if any.
 *
 * All three list bodies and the shell need this same scan, and `Object.values`
 * allocates a fresh array each time; the call sites memoise it against the list
 * identity rather than re-scanning on every render.
 * @param list - always-mounted Session list snapshot.
 * @returns the retained Session id, or undefined when the main view holds none.
 */
export function mainViewSessionId(list) {
    return Object.values(list.byId).find(session => (session.retainedBy.mainView ?? 0) > 0)?.id;
}
//# sourceMappingURL=browser-shared.js.map