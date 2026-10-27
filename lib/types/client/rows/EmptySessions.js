import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** The list-empty placeholder shared by the tree, flat, and search list bodies. */
import { IconArchiveOutlineRegular, IconQueueOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives';
import css from './WorkspaceBrowser.module.css';
/** The list-empty placeholder — a glyph over the text; the archived-only view names its filter and offers the way back. */
export function EmptySessions({ rowState, onLeaveArchivedOnly, t }) {
    const archivedOnly = rowState.archivedFilter === 'only';
    return (_jsxs("div", { className: css.emptyState, "data-row-key": "empty", children: [archivedOnly ? _jsx(IconArchiveOutlineRegular, { size: 24 }) : _jsx(IconQueueOutlineRegular, { size: 24 }), _jsx("div", { children: archivedOnly ? t('empty.noneArchived') : t('empty.none') }), archivedOnly && (_jsx("button", { type: "button", className: css.emptyAction, onClick: onLeaveArchivedOnly, children: t('empty.viewOthers') }))] }));
}
//# sourceMappingURL=EmptySessions.js.map