/** Shared Workspace notice presentation and keyed business adapters. */
import { Toast, IconWarningOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ToastDisplay, ToastOccurrence,
} from '../contract/toast.ts'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

type Translate = PropsLocale<'workspace'>['t']

/** Shape read by the plain keyed entries. */
interface ToastEntryShape {
  dismissToast: () => void
  display: (notice: never, t: Translate, dismiss: () => void) => ToastDisplay
  t: Translate
  renderFactorySlot: (name: 'workspace.toast.content', props: ToastOccurrence) => unknown
  seq: number
  kind: string
}

/** Shape read by the archive keyed entries. */
interface ArchiveToastShape extends ToastEntryShape {
  sessionId: SessionId
  useStore: <T>(selector: (state: { archivedFilter?: 'default' | 'show' | 'only' }) => T) => T
  filterAction: (t: Translate, dismiss: () => void) => NonNullable<ToastDisplay['actions']>[number]
}

/**
 * Render one notice using the shared Factory.
 * @param props - keyed payload, injected display mapping, locale, and Factory renderer.
 * @returns the shared Toast occurrence.
 */
export function ToastEntry(props: ToastEntryShape) {
  const { dismissToast, display, t, renderFactorySlot, seq } = props
  const displayFields = display(
    // The keyed dispatcher has already selected this registration by `props.kind`.
    { ...props } as never,
    t,
    dismissToast,
  )
  return renderFactorySlot('workspace.toast.content', {
    ...displayFields,
    seq,
    onDone: dismissToast,
  })
}

/**
 * Keep the archive filter action reactive without subscribing unrelated notices.
 * @param props - archive notice, display mapping, and the existing viewing store.
 * @returns the shared Toast occurrence with its current actions.
 */
export function ArchiveToastEntry(props: ArchiveToastShape) {
  const { dismissToast, display, filterAction, useStore, t, renderFactorySlot, seq } = props
  const archivedVisible = useStore(state => (state.archivedFilter ?? 'default') !== 'default')
  const fields = display({ ...props } as never, t, dismissToast)
  return renderFactorySlot('workspace.toast.content', {
    ...fields,
    actions: [...fields.actions ?? [], ...(archivedVisible ? [] : [filterAction(t, dismissToast)])],
    seq,
    onDone: dismissToast,
  })
}

/**
 * Present plain display data with the shared primitive's timing and portal.
 * @param props - localized display fields, display identity, and dismissal.
 * @returns one Toast, remounted only for a new display identity.
 */
export function WorkspaceToast({ seq, text, tone, holdMs, actions, onDone }: ToastOccurrence) {
  return (
    <Toast
      key={seq}
      text={text}
      onDone={onDone}
      {...tone === 'success' ? { tone: 'success' } : {}}
      {...tone === 'warning' ? { icon: <IconWarningOutlineRegular /> } : {}}
      {...holdMs === undefined ? {} : { holdMs }}
      {...actions === undefined ? {} : { actions }}
    />
  )
}
