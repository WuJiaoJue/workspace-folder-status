/** The list-empty placeholder shared by the tree, flat, and search list bodies. */
import { IconArchiveOutlineRegular, IconQueueOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './WorkspaceBrowser.module.css'
import type { SessionTreeProps } from './browser-shared.ts'

/** The list-empty placeholder — a glyph over the text; the archived-only view names its filter and offers the way back. */
export function EmptySessions({ rowState, onLeaveArchivedOnly, t }: Pick<SessionTreeProps, 'rowState' | 'onLeaveArchivedOnly' | 't'>) {
  const archivedOnly = rowState.archivedFilter === 'only'
  return (
    <div className={css.emptyState} data-row-key="empty">
      {archivedOnly ? <IconArchiveOutlineRegular size={24} /> : <IconQueueOutlineRegular size={24} />}
      <div>{archivedOnly ? t('empty.noneArchived') : t('empty.none')}</div>
      {archivedOnly && (
        <button type="button" className={css.emptyAction} onClick={onLeaveArchivedOnly}>
          {t('empty.viewOthers')}
        </button>
      )}
    </div>
  )
}
