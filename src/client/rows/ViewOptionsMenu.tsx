/**
 * Grouping, ordering, and archived-filter menu for the section header.
 *
 * Own open state so it resets with the wide chrome; the trigger button is the
 * menu's own anchor, so the header does not thread a callback down for it.
 */
import { useState } from 'react'
import clsx from 'clsx'
import {
  IconArchiveCheckOutlineRegular, IconArchiveOffOutlineRegular, IconChevronsUpDownOutlineRegular,
  IconClockOutlineRegular, IconFlatListOutlineRegular, IconFolderCloseRegular, IconQueueOutlineRegular,
  IconSlidersTwoOutlineRegular, IconWorkspaceTreeOutlineRegular, Menu, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceBrowserProps } from '../contract/slots.ts'
import type { ArchivedFilter, SessionOrderBy } from '../tree.ts'
import type { SessionGroupBy } from '../stores.ts'
import css from './WorkspaceBrowser.module.css'

/** Grouping, ordering, and archived-filter menu; own open state so it resets with the wide chrome. */
export function ViewOptionsMenu({ groupBy, orderBy, archivedFilter, onGroupPick, onOrderPick, onArchivedFilterPick, t }: {
  groupBy: SessionGroupBy
  orderBy: SessionOrderBy
  archivedFilter: ArchivedFilter
  onGroupPick: (mode: SessionGroupBy) => void
  onOrderPick: (mode: SessionOrderBy) => void
  onArchivedFilterPick: (filter: ArchivedFilter) => void
  t: WorkspaceBrowserProps['t']
}) {
  const [open, setOpen] = useState(false)
  return (
    <Menu
      open={open}
      onClose={() => { setOpen(false) }}
      items={[
        { type: 'label' as const, id: 'group-by', text: t('groupBy.label') },
        { id: 'workspace', label: t('groupBy.workspace'), icon: <IconFolderCloseRegular /> },
        { id: 'workspace-tree', label: t('groupBy.workspaceTree'), icon: <IconWorkspaceTreeOutlineRegular /> },
        { id: 'flat', label: t('groupBy.flat'), icon: <IconFlatListOutlineRegular /> },
        { type: 'separator' as const, id: 'order-by-separator' },
        { type: 'label' as const, id: 'order-by', text: t('orderBy.label') },
        { id: 'manual', label: t('orderBy.manual'), icon: <IconChevronsUpDownOutlineRegular /> },
        { id: 'updated', label: t('orderBy.updated'), icon: <IconClockOutlineRegular /> },
        { type: 'separator' as const, id: 'archived-filter-separator' },
        { type: 'label' as const, id: 'filter-by', text: t('filterBy.label') },
        { id: 'hide-archived', label: t('viewOptions.hideArchived'), icon: <IconArchiveOffOutlineRegular /> },
        { id: 'show-archived', label: t('viewOptions.showArchived'), icon: <IconQueueOutlineRegular /> },
        { id: 'only-archived', label: t('viewOptions.onlyArchived'), icon: <IconArchiveCheckOutlineRegular /> },
      ]}
      selectedIds={[
        groupBy,
        orderBy,
        { default: 'hide-archived', show: 'show-archived', only: 'only-archived' }[archivedFilter],
      ]}
      onSelect={(id) => {
        if (id === 'workspace' || id === 'workspace-tree' || id === 'flat') onGroupPick(id)
        else if (id === 'manual' || id === 'updated') onOrderPick(id)
        else if (id === 'hide-archived') onArchivedFilterPick('default')
        else if (id === 'show-archived') onArchivedFilterPick('show')
        else if (id === 'only-archived') onArchivedFilterPick('only')
        setOpen(false)
      }}
      align="end"
      dense
      listClassName={css.viewOptionsMenu}
      // Portal: the section header clips overflow, so an in-place list would
      // be cut off at the header's bounds.
      portal
      anchor={(
        <Tooltip label={t('viewOptions.label')} side="bottom" delayMs={500}>
          <button
            type="button"
            className={clsx(css.iconButton, css.wide)}
            aria-label={t('viewOptions.label')}
            onClick={() => { setOpen(v => !v) }}
          >
            <IconSlidersTwoOutlineRegular />
          </button>
        </Tooltip>
      )}
    />
  )
}
