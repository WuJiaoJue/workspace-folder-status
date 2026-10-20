/** Business-owned mappings into the keyed Workspace Toast slot. */
import type { Context } from '@deepseek-ai/cordis'
import type { PropsLocale, SlotComponent } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { RowToastActions, WorkspaceViewStoreHandle } from '../contract/slots.ts'
import type { ToastDisplay } from '../contract/toast.ts'
import { ArchiveToastEntry, ToastEntry, WorkspaceToast } from './Toast.tsx'

type Translate = PropsLocale<'workspace'>['t']

/** Wrap a business display mapping without making the slot component generic. */
function plainToast(
  display: (notice: any, t: Translate, dismiss: () => void) => ToastDisplay,
) {
  return () => ({ display })
}

/**
 * Register notice presentations with their business-owned display fields and actions.
 * @param ctx - workspace plugin context.
 * @param viewStore - viewing store, read only by archive notices.
 * @param actions - archive and source-opening callbacks.
 */
export function registerToasts(
  ctx: Context,
  viewStore: WorkspaceViewStoreHandle,
  actions: Pick<RowToastActions, 'undoArchive' | 'showArchived' | 'openForkSource'>,
): void {
  const toastEntry = ToastEntry as unknown as SlotComponent<any>
  const archiveToastEntry = ArchiveToastEntry as unknown as SlotComponent<any>
  const archiveFilterAction = (t: Translate, dismiss: () => void): NonNullable<ToastDisplay['actions']>[number] => ({
    prefix: t('toast.archivedOr'),
    label: t('toast.archivedFilter'),
    onClick: () => {
      dismiss()
      actions.showArchived()
    },
  })
  ctx.slots.registerFactory({
    name: 'workspace.toast.content',
    scope: 'root',
  }, WorkspaceToast)

  ctx.slots.inject('workspace.toast', function* () {
    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'sessionIdCopied',
      locale: 'workspace',
      inject: plainToast((_notice, t) => ({
        text: t('toast.sessionIdCopied'),
        tone: 'success',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'sessionIdCopyFailed',
      locale: 'workspace',
      inject: plainToast((_notice, t) => ({
        text: t('toast.sessionIdCopyFailed'),
        tone: 'warning',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'pinFailed',
      locale: 'workspace',
      inject: plainToast((_notice, t) => ({
        text: t('toast.pinFailed'),
        tone: 'warning',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'unpinFailed',
      locale: 'workspace',
      inject: plainToast((_notice, t) => ({
        text: t('toast.unpinFailed'),
        tone: 'warning',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'archivedNotOpenable',
      locale: 'workspace',
      inject: plainToast((_notice, t) => ({
        text: t('toast.archivedNotOpenable'),
        tone: 'warning',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'defaultWorkspaceFailed',
      locale: 'workspace',
      inject: plainToast((_notice, t) => ({
        text: t('defaultWorkspace.failed'),
        tone: 'warning',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'shortcutForkFailed',
      locale: 'workspace',
      inject: plainToast((notice: { reason: 'unavailable' | 'failed' }, t) => ({
        text: t(notice.reason === 'unavailable' ? 'shortcut.noCompletedTurn' : 'shortcut.forkFailed'),
        tone: 'plain',
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'createFailed',
      locale: 'workspace',
      inject: plainToast((notice: { message: string }, t) => ({
        text: t('toast.createFailed', { message: notice.message }),
        tone: 'warning',
        holdMs: 6000,
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'forkRequiresOpen',
      locale: 'workspace',
      inject: plainToast((notice: { sessionId: SessionId }, t, dismiss) => ({
        text: t('toast.forkRequiresOpen'),
        tone: 'warning',
        holdMs: 6000,
        actions: [{
          label: t('toast.openForkSource'),
          onClick: () => {
            dismiss()
            actions.openForkSource(notice.sessionId)
          },
        }],
      })),
    }, toastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'archived',
      locale: 'workspace',
      store: viewStore,
      inject: () => ({
        display: (notice: { sessionId: SessionId }, t: Translate, dismiss: () => void): ToastDisplay => ({
          text: t('toast.archived'),
          tone: 'success',
          holdMs: 6000,
          actions: [{
            label: t('toast.archivedUndo'),
            onClick: () => {
              dismiss()
              actions.undoArchive(notice.sessionId)
            },
          }],
        }),
        filterAction: archiveFilterAction,
      }),
    }, archiveToastEntry)

    yield ctx.slots.register({
      name: 'workspace.toast',
      key: 'stoppedAndArchived',
      locale: 'workspace',
      store: viewStore,
      inject: () => ({
        display: (notice: { sessionId: SessionId }, t: Translate, dismiss: () => void): ToastDisplay => ({
          text: t('toast.stoppedAndArchived'),
          tone: 'success',
          holdMs: 6000,
          actions: [{
            label: t('toast.archivedUndo'),
            onClick: () => {
              dismiss()
              actions.undoArchive(notice.sessionId)
            },
          }],
        }),
        filterAction: archiveFilterAction,
      }),
    }, archiveToastEntry)
  })
}
