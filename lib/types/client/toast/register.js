import { ArchiveToastEntry, ToastEntry, WorkspaceToast } from "./Toast.js";
/**
 * Wrap a business display mapping without making the slot component generic.
 * @param display - 该键的纯文案映射；`notice` 的类型由键决定，写错字段即编译失败。
 */
function plainToast(display) {
    return () => ({ display });
}
/**
 * 一条普通通知的登记数据：键与它自己的 display 成对。
 *
 * 键必须作为泛型实参先写出来，`display` 的 `notice` 才有类型——单看 display 推断不出
 * K，只能退回全部通知的联合。存下来的 `inject` 按 {@link KeyedToastInjected} 抹掉键
 * 负载：键 → 负载 的对应关系在入参这一侧已经校验过。
 */
function plainToastRow(key, display) {
    return { key, inject: plainToast(display) };
}
const ARCHIVE_TOASTS = [
    { key: 'archived', text: 'toast.archived' },
    { key: 'stoppedAndArchived', text: 'toast.stoppedAndArchived' },
];
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
    // 十一次逐字相似的 ctx.slots.register 收成「表 + 循环」：键、文案、色档、holdMs、
    // 动作都写在行里，注册循环只负责把行搬进槽。此前每次改一条公共口径（比如 locale
    // 命名空间）都得在十一个对象字面量里逐处找，漏一处不报错、只在那条通知上静默失效。
    //
    // 顺序照抄迁移前的注册顺序。keyed 槽按 key 分格，顺序本可无关，但保持原样这份表
    // 才能逐行对着原来的十一次调用核对。表建在 registerToasts 里而不是模块级：`forkRequiresOpen`
    // 的动作闭包用到本次 apply 的 `actions`，搬出去就得把回调也当参数传进来。
    const plainToasts = [
        plainToastRow('sessionIdCopied', (_notice, t) => ({
            text: t('toast.sessionIdCopied'),
            tone: 'success',
        })),
        plainToastRow('sessionIdCopyFailed', (_notice, t) => ({
            text: t('toast.sessionIdCopyFailed'),
            tone: 'warning',
        })),
        plainToastRow('pinFailed', (_notice, t) => ({
            text: t('toast.pinFailed'),
            tone: 'warning',
        })),
        plainToastRow('unpinFailed', (_notice, t) => ({
            text: t('toast.unpinFailed'),
            tone: 'warning',
        })),
        plainToastRow('archivedNotOpenable', (_notice, t) => ({
            text: t('toast.archivedNotOpenable'),
            tone: 'warning',
        })),
        plainToastRow('defaultWorkspaceFailed', (_notice, t) => ({
            text: t('defaultWorkspace.failed'),
            tone: 'warning',
        })),
        plainToastRow('shortcutForkFailed', (notice, t) => ({
            text: t(notice.reason === 'unavailable' ? 'shortcut.noCompletedTurn' : 'shortcut.forkFailed'),
            tone: 'plain',
        })),
        plainToastRow('createFailed', (notice, t) => ({
            text: t('toast.createFailed', { message: notice.message }),
            tone: 'warning',
            holdMs: 6000,
        })),
        plainToastRow('forkRequiresOpen', (notice, t, dismiss) => ({
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
    ];
    ctx.slots.registerFactory({
        name: 'workspace.toast.content',
        scope: 'root',
    }, WorkspaceToast);
    ctx.slots.inject('workspace.toast', function* () {
        for (const { key, inject } of plainToasts) {
            yield ctx.slots.register({
                name: 'workspace.toast',
                key,
                locale: 'workspace',
                inject,
            }, toastEntry);
        }
        for (const { key, text } of ARCHIVE_TOASTS) {
            yield ctx.slots.register({
                name: 'workspace.toast',
                key,
                locale: 'workspace',
                store: viewStore,
                inject: () => ({
                    display: (notice, t, dismiss) => ({
                        text: t(text),
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
        }
    });
}
//# sourceMappingURL=register.js.map