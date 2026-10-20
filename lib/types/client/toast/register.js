import { ArchiveToastEntry, ToastEntry, WorkspaceToast } from "./Toast.js";
/** Wrap a business display mapping without making the slot component generic. */
function plainToast(display) {
    return () => ({ display });
}
/**
 * Register notice presentations with their business-owned display fields and actions.
 * @param ctx - workspace plugin context.
 * @param viewStore - viewing store, read only by archive notices.
 * @param actions - archive and source-opening callbacks.
 */
export function registerToasts(ctx, viewStore, actions) {
    const toastEntry = ToastEntry;
    const archiveToastEntry = ArchiveToastEntry;
    const archiveFilterAction = (t, dismiss) => ({
        prefix: t('toast.archivedOr'),
        label: t('toast.archivedFilter'),
        onClick: () => {
            dismiss();
            actions.showArchived();
        },
    });
    ctx.slots.registerFactory({
        name: 'workspace.toast.content',
        scope: 'root',
    }, WorkspaceToast);
    ctx.slots.inject('workspace.toast', function* () {
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'sessionIdCopied',
            locale: 'workspace',
            inject: plainToast((_notice, t) => ({
                text: t('toast.sessionIdCopied'),
                tone: 'success',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'sessionIdCopyFailed',
            locale: 'workspace',
            inject: plainToast((_notice, t) => ({
                text: t('toast.sessionIdCopyFailed'),
                tone: 'warning',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'pinFailed',
            locale: 'workspace',
            inject: plainToast((_notice, t) => ({
                text: t('toast.pinFailed'),
                tone: 'warning',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'unpinFailed',
            locale: 'workspace',
            inject: plainToast((_notice, t) => ({
                text: t('toast.unpinFailed'),
                tone: 'warning',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'archivedNotOpenable',
            locale: 'workspace',
            inject: plainToast((_notice, t) => ({
                text: t('toast.archivedNotOpenable'),
                tone: 'warning',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'defaultWorkspaceFailed',
            locale: 'workspace',
            inject: plainToast((_notice, t) => ({
                text: t('defaultWorkspace.failed'),
                tone: 'warning',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'shortcutForkFailed',
            locale: 'workspace',
            inject: plainToast((notice, t) => ({
                text: t(notice.reason === 'unavailable' ? 'shortcut.noCompletedTurn' : 'shortcut.forkFailed'),
                tone: 'plain',
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'createFailed',
            locale: 'workspace',
            inject: plainToast((notice, t) => ({
                text: t('toast.createFailed', { message: notice.message }),
                tone: 'warning',
                holdMs: 6000,
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'forkRequiresOpen',
            locale: 'workspace',
            inject: plainToast((notice, t, dismiss) => ({
                text: t('toast.forkRequiresOpen'),
                tone: 'warning',
                holdMs: 6000,
                actions: [{
                        label: t('toast.openForkSource'),
                        onClick: () => {
                            dismiss();
                            actions.openForkSource(notice.sessionId);
                        },
                    }],
            })),
        }, toastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'archived',
            locale: 'workspace',
            store: viewStore,
            inject: () => ({
                display: (notice, t, dismiss) => ({
                    text: t('toast.archived'),
                    tone: 'success',
                    holdMs: 6000,
                    actions: [{
                            label: t('toast.archivedUndo'),
                            onClick: () => {
                                dismiss();
                                actions.undoArchive(notice.sessionId);
                            },
                        }],
                }),
                filterAction: archiveFilterAction,
            }),
        }, archiveToastEntry);
        yield ctx.slots.register({
            name: 'workspace.toast',
            key: 'stoppedAndArchived',
            locale: 'workspace',
            store: viewStore,
            inject: () => ({
                display: (notice, t, dismiss) => ({
                    text: t('toast.stoppedAndArchived'),
                    tone: 'success',
                    holdMs: 6000,
                    actions: [{
                            label: t('toast.archivedUndo'),
                            onClick: () => {
                                dismiss();
                                actions.undoArchive(notice.sessionId);
                            },
                        }],
                }),
                filterAction: archiveFilterAction,
            }),
        }, archiveToastEntry);
    });
}
//# sourceMappingURL=register.js.map